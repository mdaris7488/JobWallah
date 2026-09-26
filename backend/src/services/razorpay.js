import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { safeEqualHex } from '../utils/otp.js';

/**
 * Thin Razorpay REST client (no SDK needed) + signature helpers.
 * Card / UPI details never touch our server: Razorpay Checkout collects them, we only receive ids + a signature.
 */
const authHeader = () => `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`;
const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');

export const rupeesToPaise = (rupees) => Math.round(rupees * 100);

async function call(method, path, body) {
  let res;
  try {
    res = await fetch(`${env.RAZORPAY_API_BASE}${path}`, {
      method,
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error('Razorpay request failed:', err.message);
    throw new ApiError(502, 'The payment gateway did not respond. Please try again in a minute.', { code: 'GATEWAY_ERROR' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Razorpay error', res.status, JSON.stringify(data?.error || data).slice(0, 300));
    throw new ApiError(502, 'The payment gateway is unavailable right now. Please try again in a minute.', { code: 'GATEWAY_ERROR' });
  }
  return data;
}

export const createRazorpayOrder = ({ amountPaise, receipt, notes }) =>
  call('POST', '/v1/orders', { amount: amountPaise, currency: 'INR', receipt: String(receipt).slice(0, 40), notes });
export const fetchRazorpayPayment = (paymentId) => call('GET', `/v1/payments/${encodeURIComponent(paymentId)}`);
export const captureRazorpayPayment = (paymentId, amountPaise) =>
  call('POST', `/v1/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountPaise, currency: 'INR' });

/** Signature sent by Checkout after a successful payment: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  if (!env.RAZORPAY_KEY_SECRET || !orderId || !paymentId || !signature) return false;
  return safeEqualHex(hmac(env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`), signature);
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook_secret) in the X-Razorpay-Signature header. */
export function verifyWebhookSignature(rawBody, signature) {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature || !Buffer.isBuffer(rawBody)) return false;
  return safeEqualHex(hmac(env.RAZORPAY_WEBHOOK_SECRET, rawBody), signature);
}
