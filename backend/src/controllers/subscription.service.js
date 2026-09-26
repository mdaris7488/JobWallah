import { Subscription } from '../models/Subscription.js';

/** What the user's active subscriptions unlock. */
export async function getEntitlements(userId) {
  const subs = await Subscription.find({ user: userId, status: 'active', endsAt: { $gt: new Date() } }).lean();
  return {
    unlimited: subs.some((s) => s.plan !== 'single_exam'),
    examIds: subs.filter((s) => s.plan === 'single_exam' && s.exam).map((s) => String(s.exam)),
    plans: subs.map((s) => s.plan),
  };
}
