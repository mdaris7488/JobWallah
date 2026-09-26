import { env } from '../config/env.js';
import { PLANS, ROLES } from '../config/constants.js';
import { Payment } from '../models/Payment.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/helpers.js';
import {
  captureRazorpayPayment, fetchRazorpayPayment, rupeesToPaise, verifyCheckoutSignature, verifyWebhookSignature,
} from '../services/razorpay.js';
import { createOrder, fulfillPayment, markFailed, markRefunded, paymentView } from '../services/payments.js';
import { buildReceiptPdf } from '../services/invoice.js';
import crypto from 'node:crypto';

// POST /payments/orders  { plan, jobId? }
export const createOrderCtl = asyncHandler(async (req, res) => {
  const checkout = await createOrder(req.user, req.body);
  res.status(201).json({ success: true, data: { ...checkout, mode: env.PAYMENT_MODE } });
});

// POST /payments/verify  - called by the browser after Razorpay Checkout succeeded
export const verifyPayment = asyncHandler(async (req, res) => {
  const { paymentId, razorpay_order_id: orderId, razorpay_payment_id: rzpPaymentId, razorpay_signature: signature } = req.body;
  const payment = await Payment.findOne({ _id: paymentId, user: req.user._id });
  if (!payment || payment.provider !== 'razorpay') throw new ApiError(404, 'Payment not found.');
  if (payment.providerOrderId !== orderId) throw new ApiError(400, 'This payment does not belong to the order.', { code: 'ORDER_MISMATCH' });
  if (!verifyCheckoutSignature({ orderId, paymentId: rzpPaymentId, signature })) {
    throw new ApiError(400, 'Payment verification failed. If money was deducted it will be refunded automatically.', { code: 'SIGNATURE_INVALID' });
  }

  // Signature proves authenticity; also confirm with Razorpay that the money really was captured for the right amount.
  let rp = await fetchRazorpayPayment(rzpPaymentId);
  if (rp.order_id !== orderId || rp.amount !== rupeesToPaise(payment.amount) || rp.currency !== 'INR') {
    throw new ApiError(400, 'Payment details do not match the order.', { code: 'ORDER_MISMATCH' });
  }
  if (rp.status === 'authorized') rp = await captureRazorpayPayment(rzpPaymentId, rupeesToPaise(payment.amount));
  if (rp.status !== 'captured') throw new ApiError(409, 'Your payment is not completed yet. Please wait a moment and check again.', { code: 'PAYMENT_PENDING' });

  const result = await fulfillPayment(payment._id, { providerPaymentId: rzpPaymentId, method: rp.method });
  res.json({ success: true, data: { payment: paymentView(result.payment), endsAt: result.subscription.endsAt } });
});

// POST /payments/demo/confirm  - demo mode only (no money involved)
export const demoConfirm = asyncHandler(async (req, res) => {
  if (env.PAYMENT_MODE !== 'demo') throw new ApiError(404, 'Not found.');
  const payment = await Payment.findOne({ _id: req.body.paymentId, user: req.user._id, provider: 'demo' });
  if (!payment) throw new ApiError(404, 'Payment not found.');
  const result = await fulfillPayment(payment._id, { providerPaymentId: `demo_pay_${crypto.randomUUID()}`, method: 'demo' });
  res.json({ success: true, data: { payment: paymentView(result.payment), endsAt: result.subscription.endsAt } });
});

export const myPayments = asyncHandler(async (req, res) => {
  const items = await Payment.find({ user: req.user._id, status: { $in: ['paid', 'refunded', 'failed'] } })
    .sort('-createdAt').limit(50).populate('exam', 'title slug');
  res.json({ success: true, data: items.map(paymentView) });
});

// GET /payments/:id/invoice  -> PDF receipt (owner or admin)
export const receipt = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate('exam', 'title');
  const allowed = payment && (String(payment.user) === String(req.user._id) || req.user.role === ROLES.ADMIN);
  if (!allowed) throw new ApiError(404, 'Receipt not found.');
  if (!['paid', 'refunded'].includes(payment.status) || !payment.invoiceNo) throw new ApiError(409, 'A receipt is available only for completed payments.');
  const def = PLANS[payment.plan];
  const pdf = await buildReceiptPdf({
    receiptNo: payment.invoiceNo, paidAt: payment.paidAt, status: payment.status, billing: payment.billing,
    planName: def.name + (payment.exam?.title ? ` - ${payment.exam.title}` : ''), validity: `Valid for ${def.days} days`,
    amount: payment.amount, paymentId: payment.providerPaymentId, method: payment.method, provider: payment.provider,
  });
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${payment.invoiceNo}.pdf"`, 'Cache-Control': 'no-store', 'Content-Length': String(pdf.length) });
  res.end(pdf);
});

/**
 * POST /payments/webhook  (Razorpay -> our server). The route is mounted BEFORE express.json() with express.raw(),
 * because the signature is calculated over the exact bytes Razorpay sent.
 */
export async function razorpayWebhook(req, res) {
  if (!verifyWebhookSignature(req.body, req.get('x-razorpay-signature'))) return res.status(400).json({ success: false, message: 'Invalid signature' });
  let event;
  try { event = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).json({ success: false, message: 'Bad payload' }); }

  try {
    const entity = event.payload?.payment?.entity;
    const orderId = entity?.order_id || event.payload?.order?.entity?.id;
    switch (event.event) {
      case 'payment.captured':
      case 'order.paid': {
        const payment = orderId && await Payment.findOne({ providerOrderId: orderId, provider: 'razorpay' });
        if (payment && entity && entity.amount === rupeesToPaise(payment.amount) && entity.currency === 'INR') {
          await fulfillPayment(payment._id, { providerPaymentId: entity.id, method: entity.method });
        }
        break;
      }
      case 'payment.failed':
        if (orderId) await markFailed(orderId, entity?.error_description);
        break;
      case 'refund.processed':
      case 'payment.refunded': {
        const paymentId = event.payload?.refund?.entity?.payment_id || entity?.id;
        if (paymentId) await markRefunded(paymentId);
        break;
      }
      default: break; // other events are ignored on purpose
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Webhook processing failed:', err);
    return res.status(500).json({ success: false }); // Razorpay will retry
  }
}

// ------------------------------------------------------------------ admin
export const adminListPayments = asyncHandler(async (req, res) => {
  const { page, limit, status, q } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.user = { $in: await User.distinct('_id', { $or: [{ name: rx }, { email: rx }, { phone: rx }] }) };
  }
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [items, total, sums] = await Promise.all([
    Payment.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit)
      .populate('user', 'name email phone').populate('exam', 'title'),
    Payment.countDocuments(filter),
    Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, revenue: { $sum: '$amount' }, count: { $sum: 1 }, last30: { $sum: { $cond: [{ $gte: ['$paidAt', since] }, '$amount', 0] } } } },
    ]),
  ]);
  res.json({
    success: true,
    data: items.map((p) => ({ ...paymentView(p), user: p.user, billing: p.billing, providerPaymentId: p.providerPaymentId, failedReason: p.failedReason })),
    meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    summary: { revenue: sums[0]?.revenue || 0, paidCount: sums[0]?.count || 0, last30: sums[0]?.last30 || 0 },
  });
});
