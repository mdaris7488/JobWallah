import { ToolUsage } from '../models/ToolUsage.js';
import { getEntitlements } from '../controllers/subscription.service.js';
import { ApiError } from '../utils/ApiError.js';
import { DAY_MS, ROLES, TOOL_TIERS } from '../config/constants.js';

/** Quota resets at midnight India time. */
export const istDay = () => new Date(Date.now() + 19_800_000).toISOString().slice(0, 10);

export const tierRank = (tier) => TOOL_TIERS.indexOf(tier);

export async function resolvePlan(user) {
  if (user.role === ROLES.ADMIN) return 'annual';
  const ent = await getEntitlements(user._id);
  if (ent.plans.includes('annual_pass')) return 'annual';
  if (ent.unlimited) return 'pro';
  return 'free';
}

export async function getUsage(userId) {
  const doc = await ToolUsage.findOne({ user: userId, day: istDay() }).lean();
  return { total: doc?.total || 0, video: doc?.video || 0 };
}

/**
 * Atomically reserves one operation for today. The unique (user, day) index + the "$lt" guard in the filter make
 * this race-free: when the limit is reached the upsert tries to insert a duplicate and fails with code 11000.
 */
export async function reserveQuota(userId, kind, limits) {
  const day = istDay();
  const filter = { user: userId, day, total: { $lt: limits.dailyOps } };
  const inc = { total: 1, video: 0 };
  if (kind === 'video') { filter.video = { $lt: limits.dailyVideo }; inc.video = 1; }
  try {
    await ToolUsage.findOneAndUpdate(
      filter,
      { $inc: inc, $setOnInsert: { expiresAt: new Date(Date.now() + 3 * DAY_MS) } },
      { upsert: true, new: true, setDefaultsOnInsert: false }
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
    const usage = await getUsage(userId);
    const videoBlocked = kind === 'video' && usage.video >= limits.dailyVideo;
    throw new ApiError(
      429,
      videoBlocked
        ? `Daily video limit reached (${limits.dailyVideo}). It resets at midnight IST. Upgrade to Pro for more.`
        : `Daily limit reached (${limits.dailyOps} tool uses). It resets at midnight IST. Upgrade to Pro for more.`,
      { code: 'DAILY_LIMIT' }
    );
  }
  return { userId, day, kind };
}

/** Give the quota back when an operation failed (users should not lose a try because of an error). */
export async function refundQuota(reservation) {
  if (!reservation) return;
  await ToolUsage.updateOne(
    { user: reservation.userId, day: reservation.day, total: { $gt: 0 } },
    { $inc: { total: -1, ...(reservation.kind === 'video' ? { video: -1 } : {}) } }
  );
}
