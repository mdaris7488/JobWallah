import { ApplyClick } from '../models/ApplyClick.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { DAY_MS, ROLES } from '../config/constants.js';
import { csvCell, escapeRegex } from '../utils/helpers.js';

// POST /jobs/:id/apply-click
// The browser opens the company's official page; this call records WHO clicked so the admin can follow up.
// The redirect URL always comes from the DB (never from the client).
export const recordApplyClick = asyncHandler(async (req, res) => {
  const job = await Job.findOne({ _id: req.params.id, isPublished: true }).select('applyUrl lastDate');
  if (!job) throw new ApiError(404, 'Job not found.');
  if (job.lastDate && job.lastDate.getTime() + DAY_MS < Date.now()) {
    throw new ApiError(400, 'Applications for this job are closed.');
  }
  if (req.user.role !== ROLES.ADMIN) { // admin test-clicks must not pollute the numbers
    await ApplyClick.findOneAndUpdate(
      { user: req.user._id, job: job._id },
      { $inc: { clickCount: 1 }, $set: { lastClickedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: false }
    );
    await Job.updateOne({ _id: job._id }, { $inc: { applyClickCount: 1 } });
  }
  res.json({ success: true, data: { applyUrl: job.applyUrl } });
});

// GET /me/applications  -> jobs this user pressed "Apply" on
export const myApplications = asyncHandler(async (req, res) => {
  const items = await ApplyClick.find({ user: req.user._id }).sort('-lastClickedAt')
    .populate('job', 'title slug organization category sector lastDate applyUrl');
  res.json({ success: true, data: items });
});

// ------------------------------------------------------------------ admin
async function buildApplicantFilter({ job, category, sector, q }) {
  const filter = {};
  if (job) {
    filter.job = job;
  } else if (category || sector) {
    const jobFilter = {};
    if (category) jobFilter.category = category;
    if (sector) jobFilter.sector = sector;
    filter.job = { $in: await Job.distinct('_id', jobFilter) };
  }
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.user = { $in: await User.distinct('_id', { $or: [{ name: rx }, { email: rx }, { phone: rx }] }) };
  }
  return filter;
}

const APPLICANT_USER_FIELDS = 'name email phone qualification state';
const APPLICANT_JOB_FIELDS = 'title slug organization category sector applyUrl';

export const adminListApplicants = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const filter = await buildApplicantFilter(req.query);
  const [items, total] = await Promise.all([
    ApplyClick.find(filter).sort('-lastClickedAt').skip((page - 1) * limit).limit(limit)
      .populate('user', APPLICANT_USER_FIELDS).populate('job', APPLICANT_JOB_FIELDS),
    ApplyClick.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
});

export const adminExportApplicants = asyncHandler(async (req, res) => {
  const filter = await buildApplicantFilter(req.query);
  const rows = await ApplyClick.find(filter).sort('-lastClickedAt').limit(10000)
    .populate('user', APPLICANT_USER_FIELDS).populate('job', APPLICANT_JOB_FIELDS);
  const header = ['Name', 'Email', 'Phone', 'Qualification', 'State', 'Job', 'Company', 'Category', 'Sector', 'Clicks', 'First clicked', 'Last clicked'];
  const lines = [header.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push([
      r.user?.name, r.user?.email, r.user?.phone, r.user?.qualification, r.user?.state,
      r.job?.title, r.job?.organization, r.job?.category, r.job?.sector,
      r.clickCount, r.createdAt?.toISOString(), r.lastClickedAt?.toISOString(),
    ].map(csvCell).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="applicants-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`\uFEFF${lines.join('\r\n')}`);
});
