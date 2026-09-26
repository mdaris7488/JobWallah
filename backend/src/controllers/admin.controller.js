import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { ApplyClick } from '../models/ApplyClick.js';
import { Subscription } from '../models/Subscription.js';
import { Payment } from '../models/Payment.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex, openCondition } from '../utils/helpers.js';

export const stats = asyncHandler(async (req, res) => {
  const [users, jobs, activeJobs, govJobs, privateJobs, applicants, clicksAgg, activeSubs, byCategory, recentApplicants, topJobs, revenueAgg] =
    await Promise.all([
      User.countDocuments({ role: 'user' }),
      Job.countDocuments(),
      Job.countDocuments(openCondition()),
      Job.countDocuments({ sector: 'government' }),
      Job.countDocuments({ sector: 'private' }),
      ApplyClick.countDocuments(),
      ApplyClick.aggregate([{ $group: { _id: null, clicks: { $sum: '$clickCount' } } }]),
      Subscription.countDocuments({ status: 'active', endsAt: { $gt: new Date() } }),
      Job.aggregate([
        { $group: { _id: { category: '$category', sector: '$sector' }, jobs: { $sum: 1 }, applyClicks: { $sum: '$applyClickCount' } } },
        { $sort: { jobs: -1 } },
      ]),
      ApplyClick.find().sort('-lastClickedAt').limit(6).populate('user', 'name email').populate('job', 'title slug category'),
      Job.find().sort('-applyClickCount').limit(5).select('title slug category viewCount applyClickCount sector'),
      Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, revenue: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    ]);
  res.json({
    success: true,
    data: {
      counts: { users, jobs, activeJobs, govJobs, privateJobs, applicants, applyClicks: clicksAgg[0]?.clicks || 0, activeSubs, revenue: revenueAgg[0]?.revenue || 0, paidPayments: revenueAgg[0]?.count || 0 },
      byCategory: byCategory.map((c) => ({ category: c._id.category, sector: c._id.sector, jobs: c.jobs, applyClicks: c.applyClicks })),
      recentApplicants,
      topJobs,
    },
  });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, q } = req.query;
  const filter = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
});

export const setUserStatus = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw new ApiError(400, 'You cannot change your own status.');
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');
  if (user.role === 'admin') throw new ApiError(403, 'Admin accounts cannot be disabled from here.');
  user.isActive = req.body.isActive;
  await user.save();
  if (!user.isActive) await RefreshToken.updateMany({ user: user._id, revokedAt: { $exists: false } }, { revokedAt: new Date() });
  res.json({ success: true, data: { user } });
});
