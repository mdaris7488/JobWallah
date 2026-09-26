import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { Bookmark } from '../models/Bookmark.js';
import { ApplyClick } from '../models/ApplyClick.js';
import { Update } from '../models/Update.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { DAY_MS, FREE_FOLLOW_LIMIT } from '../config/constants.js';
import { getEntitlements } from './subscription.service.js';
import { issueSession } from './auth.controller.js';

const CARD_FIELDS = 'title slug organization sector category vacancies qualification state location salary lastDate examDate postedAt';

// ---------------------------------------------------------------- profile
export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const { state, phone, ...rest } = req.body;
  user.set(rest);
  if (state !== undefined) user.state = state || undefined;
  if (phone !== undefined) user.phone = phone || undefined;
  await user.save();
  res.json({ success: true, data: { user } });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) throw new ApiError(400, 'Current password is incorrect.');
  user.password = newPassword; // hashed by the pre-save hook, also stamps passwordChangedAt
  await user.save();
  await RefreshToken.updateMany({ user: user._id, revokedAt: { $exists: false } }, { revokedAt: new Date() });
  const accessToken = await issueSession(req, res, user); // keep this device signed in
  res.json({ success: true, message: 'Password updated. Other devices were signed out.', data: { accessToken } });
});

// ---------------------------------------------------------------- dashboard
export const dashboard = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  const [saved, followed, applications, recentSaved, tracked] = await Promise.all([
    Bookmark.countDocuments({ user: uid, kind: 'save' }),
    Bookmark.countDocuments({ user: uid, kind: 'follow' }),
    ApplyClick.countDocuments({ user: uid }),
    Bookmark.find({ user: uid, kind: 'save' }).sort('-createdAt').limit(5).populate('job', CARD_FIELDS),
    Bookmark.find({ user: uid }).populate('job', 'title slug lastDate examDate'),
  ]);

  const now = Date.now();
  const events = new Map();
  for (const b of tracked) {
    const j = b.job;
    if (!j) continue;
    if (j.examDate && j.examDate.getTime() >= now) {
      events.set(`${j.slug}:exam`, { slug: j.slug, title: j.title, label: 'Exam date', date: j.examDate });
    }
    if (j.lastDate && j.lastDate.getTime() + DAY_MS >= now) {
      events.set(`${j.slug}:last`, { slug: j.slug, title: j.title, label: 'Last date to apply', date: j.lastDate });
    }
  }
  const upcoming = [...events.values()].sort((a, b) => a.date - b.date).slice(0, 6);

  res.json({
    success: true,
    data: {
      counts: { saved, followed, applications, upcoming: upcoming.length },
      recentSaved: recentSaved.map((b) => b.job).filter(Boolean),
      upcoming,
    },
  });
});

// ---------------------------------------------------------------- bookmarks (saved jobs / followed exams)
export const listBookmarks = asyncHandler(async (req, res) => {
  const items = await Bookmark.find({ user: req.user._id, kind: req.query.kind }).sort('-createdAt').populate('job', CARD_FIELDS);
  res.json({ success: true, data: items.map((b) => b.job).filter(Boolean) });
});

export const addBookmark = asyncHandler(async (req, res) => {
  const { jobId, kind } = req.body;
  const uid = req.user._id;
  const job = await Job.findOne({ _id: jobId, isPublished: true }).select('_id');
  if (!job) throw new ApiError(404, 'Job not found.');

  if (kind === 'follow' && !(await Bookmark.exists({ user: uid, job: jobId, kind }))) {
    const ent = await getEntitlements(uid);
    if (!ent.unlimited && !ent.examIds.includes(String(jobId))) {
      const count = await Bookmark.countDocuments({ user: uid, kind: 'follow' });
      if (count >= FREE_FOLLOW_LIMIT) {
        throw new ApiError(403, `Free plan allows following up to ${FREE_FOLLOW_LIMIT} exams. Upgrade to Pro for unlimited tracking.`, { code: 'UPGRADE_REQUIRED' });
      }
    }
  }
  try {
    await Bookmark.create({ user: uid, job: jobId, kind });
  } catch (err) {
    if (err.code !== 11000) throw err; // already bookmarked -> idempotent
  }
  res.status(201).json({ success: true, message: 'Saved.' });
});

export const removeBookmark = asyncHandler(async (req, res) => {
  await Bookmark.deleteOne({ user: req.user._id, job: req.params.jobId, kind: req.params.kind });
  res.json({ success: true, message: 'Removed.' });
});

// ---------------------------------------------------------------- premium: admit card / result alerts for followed exams
export const myUpdates = asyncHandler(async (req, res) => {
  const ent = await getEntitlements(req.user._id);
  if (!ent.unlimited && ent.examIds.length === 0) {
    throw new ApiError(403, 'Admit card and result alerts are part of the Pro plans.', { code: 'UPGRADE_REQUIRED' });
  }
  const followed = await Bookmark.find({ user: req.user._id, kind: 'follow' }).select('job');
  let jobIds = followed.map((f) => String(f.job));
  if (!ent.unlimited) jobIds = jobIds.filter((id) => ent.examIds.includes(id));
  const items = await Update.find({ job: { $in: jobIds }, isPublished: true }).sort('-publishedAt').limit(50).populate('job', 'title slug');
  res.json({ success: true, data: items });
});
