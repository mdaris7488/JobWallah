import { env } from '../config/env.js';
import { PLANS } from '../config/constants.js';
import { Subscription } from '../models/Subscription.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getEntitlements } from './subscription.service.js';

// Plans are bought through the payment flow (/payments/orders -> Razorpay -> /payments/verify).
export const listPlans = (req, res) => {
  res.json({
    success: true,
    data: { paymentMode: env.PAYMENT_MODE, currency: 'INR', plans: Object.entries(PLANS).map(([id, p]) => ({ id, ...p })) },
  });
};

export const mySubscriptions = asyncHandler(async (req, res) => {
  const [subscriptions, entitlements] = await Promise.all([
    Subscription.find({ user: req.user._id }).sort('-createdAt').populate('exam', 'title slug'),
    getEntitlements(req.user._id),
  ]);
  res.json({ success: true, data: { subscriptions, entitlements } });
});
