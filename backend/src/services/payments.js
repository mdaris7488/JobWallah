import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { DAY_MS, PLANS } from '../config/constants.js';
import { Payment } from '../models/Payment.js';
import { Subscription } from '../models/Subscription.js';
import { Job } from '../models/Job.js';
import { Bookmark } from '../models/Bookmark.js';
import { nextSequence } from '../models/Counter.js';
import { ApiError } from '../utils/ApiError.js';
import { createRazorpayOrder, rupeesToPaise } from './razorpay.js';
import { paymentReceiptEmail, sendMail } from './mailer.js';

const REUSE_WINDOW_MS = 30 * 60 * 1000;

/**
 * Creates (or re-uses) an unpaid order. The price ALWAYS comes from the server-side plan list,
 * so a tampered request can never change what the user pays.
 */
export async function createOrder(user, { plan, jobId }) {
  const def = PLANS[plan];
  let exam = null;
  if (plan === 'single_exam') {
    if (!jobId) throw new ApiError(400, 'Choose the exam you want to track.', { code: 'EXAM_REQUIRED' });
    exam = await Job.findOne({ _id: jobId, isPublished: true }).select('_id title');
    if (!exam) throw new ApiError(404, 'Exam not found.');
  }
  const provider = env.PAYMENT_MODE;

  // A double click / page refresh must not create a pile of orders.
  let payment = await Payment.findOne({
    user: user._id, plan, provider, status: 'created',
    exam: exam ? exam._id : { $exists: false },
    createdAt: { $gte: new Date(Date.now() - REUSE_WINDOW_MS) },
  });

  if (!payment) {
    const amountPaise = rupeesToPaise(def.price);
    let providerOrderId;
    if (provider === 'razorpay') {
      const order = await createRazorpayOrder({
        amountPaise,
        receipt: `rs_${crypto.randomBytes(8).toString('hex')}`,
        notes: { userId: String(user._id), plan, ...(exam && { examId: String(exam._id) }) },
      });
      providerOrderId = order.id;
    } else {
      providerOrderId = `demo_order_${crypto.randomUUID()}`;
    }
    payment = await Payment.create({
      user: user._id, plan, exam: exam?._id, amount: def.price, provider, providerOrderId,
      billing: { name: user.name, email: user.email, phone: user.phone },
    });
  }

  return {
    paymentId: payment._id,
    provider,
    providerOrderId: payment.providerOrderId,
    amountPaise: rupeesToPaise(payment.amount),
    currency: payment.currency,
    keyId: provider === 'razorpay' ? env.RAZORPAY_KEY_ID : undefined,
    plan: { id: plan, name: def.name, days: def.days, price: def.price },
    prefill: { name: user.name, email: user.email, contact: user.phone },
  };
}

const nextInvoiceNo = async () => {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`receipt-${year}`);
  return `RS-${year}-${String(seq).padStart(6, '0')}`;
};

/** One subscription per payment (unique index) - safe when the checkout callback and the webhook arrive together. */
async function ensureSubscription(payment) {
  const def = PLANS[payment.plan];
  const startsAt = payment.paidAt || new Date();
  let base = startsAt;
  if (payment.plan !== 'single_exam') {
    // renewing before expiry extends the current period instead of wasting the remaining days
    const current = await Subscription.findOne({
      user: payment.user, plan: payment.plan, status: 'active', endsAt: { $gt: startsAt }, payment: { $ne: payment._id },
    }).sort('-endsAt');
    if (current) base = current.endsAt;
  }
  let subscription;
  try {
    subscription = await Subscription.findOneAndUpdate(
      { payment: payment._id },
      {
        $setOnInsert: {
          user: payment.user, plan: payment.plan, amount: payment.amount, status: 'active', startsAt,
          endsAt: new Date(base.getTime() + def.days * DAY_MS), exam: payment.exam, provider: payment.provider,
          paymentRef: payment.providerPaymentId,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: false }
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
    subscription = await Subscription.findOne({ payment: payment._id });
  }
  if (!payment.subscription || String(payment.subscription) !== String(subscription._id)) {
    await Payment.updateOne({ _id: payment._id }, { subscription: subscription._id });
  }
  // Single Exam Pass buys tracking for one exam - auto-follow it so alerts work without a separate manual step.
  if (payment.plan === 'single_exam' && payment.exam) {
    await Bookmark.updateOne(
      { user: payment.user, job: payment.exam, kind: 'follow' },
      { $setOnInsert: { user: payment.user, job: payment.exam, kind: 'follow' } },
      { upsert: true }
    ).catch(() => {}); // best-effort - a missing follow row never blocks payment fulfilment
  }
  return subscription;
}

/**
 * Marks the payment as paid and activates the plan. Idempotent: the atomic status change lets exactly one caller
 * "win"; everybody else just gets the already-created result.
 */
export async function fulfillPayment(paymentId, { providerPaymentId, method } = {}) {
  const $set = { status: 'paid', paidAt: new Date() };
  if (providerPaymentId) $set.providerPaymentId = providerPaymentId;
  if (method) $set.method = method;

  const claimed = await Payment.findOneAndUpdate(
    { _id: paymentId, status: { $in: ['created', 'failed'] } }, // a failed attempt can still succeed on retry
    { $set, $unset: { failedReason: 1 } },
    { new: true }
  );

  if (!claimed) {
    const existing = await Payment.findById(paymentId);
    if (!existing) throw new ApiError(404, 'Payment not found.');
    if (existing.status !== 'paid') throw new ApiError(409, 'This payment can no longer be completed.');
    const subscription = await ensureSubscription(existing); // repairs a crash between "paid" and "subscription"
    return { payment: existing, subscription, firstTime: false };
  }

  if (!claimed.invoiceNo) {
    await Payment.updateOne({ _id: claimed._id, invoiceNo: { $exists: false } }, { invoiceNo: await nextInvoiceNo() });
  }
  const payment = await Payment.findById(claimed._id);
  const subscription = await ensureSubscription(payment);

  sendMail({
    to: payment.billing.email,
    ...paymentReceiptEmail({
      name: payment.billing.name, planName: PLANS[payment.plan].name, amount: payment.amount,
      receiptNo: payment.invoiceNo, endsAt: subscription.endsAt,
    }),
  }).catch((err) => console.error('Receipt email failed:', err.message));
  return { payment, subscription, firstTime: true };
}

export async function markFailed(providerOrderId, reason) {
  await Payment.updateOne({ providerOrderId, status: 'created' }, { status: 'failed', failedReason: String(reason || 'Payment failed').slice(0, 300) });
}

export async function markRefunded(providerPaymentId) {
  const payment = await Payment.findOneAndUpdate({ providerPaymentId, status: 'paid' }, { status: 'refunded' }, { new: true });
  if (payment) await Subscription.updateOne({ payment: payment._id }, { status: 'cancelled' });
  return payment;
}

export const paymentView = (p) => ({
  id: p._id, plan: p.plan, planName: PLANS[p.plan]?.name, amount: p.amount, currency: p.currency, status: p.status,
  provider: p.provider, method: p.method, paidAt: p.paidAt, createdAt: p.createdAt, invoiceNo: p.invoiceNo,
  exam: p.exam && p.exam.title ? { title: p.exam.title, slug: p.exam.slug } : undefined,
});
