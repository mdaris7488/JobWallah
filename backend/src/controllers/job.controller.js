import crypto from 'node:crypto';
import slugify from 'slugify';
import { Job } from '../models/Job.js';
import { ApplyClick } from '../models/ApplyClick.js';
import { Bookmark } from '../models/Bookmark.js';
import { Update } from '../models/Update.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex, expiryCutoff, openCondition } from '../utils/helpers.js';

const LIST_PROJECTION =
  '-description -responsibilities -requirements -benefits -vacancyDetails -eligibility -ageLimitDetails -salaryDetails -selectionProcess -howToApply -importantLinks -createdBy -updatedBy';

function buildFilter(q, { admin = false } = {}) {
  const f = {};
  const and = [];
  if (!admin) f.isPublished = true;
  else if (q.published !== undefined) f.isPublished = q.published === 'true';

  for (const key of ['sector', 'category', 'state', 'jobType', 'workMode']) if (q[key]) f[key] = q[key];
  if (q.qualification) f.qualification = new RegExp(escapeRegex(q.qualification), 'i');
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    and.push({ $or: [{ title: rx }, { organization: rx }, { category: rx }] });
  }
  if (q.status === 'active') and.push(openCondition());
  if (q.status === 'expired') and.push({ lastDate: { $lt: expiryCutoff() } });
  if (and.length) f.$and = and;
  return f;
}

async function respondWithList(req, res, opts) {
  const q = req.query;
  const filter = buildFilter(q, opts);
  const sort = q.sort === 'lastDate' ? { lastDate: 1 } : { postedAt: -1, _id: -1 };
  const [items, total] = await Promise.all([
    Job.find(filter).select(LIST_PROJECTION).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit),
    Job.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: items,
    meta: { page: q.page, limit: q.limit, total, pages: Math.max(1, Math.ceil(total / q.limit)) },
  });
}

// ------------------------------------------------------------------ public
export const listJobs = asyncHandler((req, res) => respondWithList(req, res, { admin: false }));

export const jobStats = asyncHandler(async (req, res) => {
  const match = { isPublished: true, ...openCondition() };
  const [categories, states, sectors] = await Promise.all([
    Job.aggregate([{ $match: match }, { $group: { _id: '$category', jobs: { $sum: 1 }, vacancies: { $sum: '$vacancies' } } }]),
    Job.aggregate([{ $match: match }, { $group: { _id: '$state', jobs: { $sum: 1 } } }]),
    Job.aggregate([{ $match: match }, { $group: { _id: '$sector', jobs: { $sum: 1 } } }]),
  ]);
  res.json({
    success: true,
    data: {
      categories: categories.map((c) => ({ category: c._id, jobs: c.jobs, vacancies: c.vacancies })),
      states: states.map((s) => ({ state: s._id, jobs: s.jobs })),
      sectors: sectors.map((s) => ({ sector: s._id, jobs: s.jobs })),
    },
  });
});

export const getJobBySlug = asyncHandler(async (req, res) => {
  const job = await Job.findOneAndUpdate(
    { slug: req.params.slug, isPublished: true },
    { $inc: { viewCount: 1 } },
    { new: true }
  ).select('-createdBy -updatedBy');
  if (!job) throw new ApiError(404, 'Job not found.');

  let userState = null;
  if (req.user) {
    const [marks, click] = await Promise.all([
      Bookmark.find({ user: req.user._id, job: job._id }).select('kind'),
      ApplyClick.findOne({ user: req.user._id, job: job._id }).select('lastClickedAt'),
    ]);
    userState = {
      saved: marks.some((m) => m.kind === 'save'),
      followed: marks.some((m) => m.kind === 'follow'),
      appliedAt: click ? click.lastClickedAt : null,
    };
  }
  res.json({ success: true, data: { job, userState } });
});

// ------------------------------------------------------------------ admin
export const adminListJobs = asyncHandler((req, res) => respondWithList(req, res, { admin: true }));

export const adminGetJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) throw new ApiError(404, 'Job not found.');
  res.json({ success: true, data: { job } });
});

export const createJob = asyncHandler(async (req, res) => {
  const base = slugify(req.body.title, { lower: true, strict: true }).slice(0, 80) || 'job';
  const slug = `${base}-${crypto.randomBytes(3).toString('hex')}`; // stable public URL
  const job = await Job.create({ ...req.body, slug, createdBy: req.user._id, updatedBy: req.user._id });
  res.status(201).json({ success: true, data: { job } });
});

export const updateJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) throw new ApiError(404, 'Job not found.');
  job.set(req.body);
  job.updatedBy = req.user._id;
  await job.save();
  res.json({ success: true, data: { job } });
});

export const deleteJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) throw new ApiError(404, 'Job not found.');

  // Cascade: apply-click history + bookmarks; keep announcements but detach them.
  await Promise.all([
    ApplyClick.deleteMany({ job: job._id }),
    Bookmark.deleteMany({ job: job._id }),
    Update.updateMany({ job: job._id }, { $unset: { job: 1 } }),
  ]);
  await job.deleteOne();
  res.json({ success: true, message: 'Job deleted.' });
});
