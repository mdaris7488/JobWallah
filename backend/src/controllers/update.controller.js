import { Update } from '../models/Update.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const list = (admin) => asyncHandler(async (req, res) => {
  const { type, page, limit } = req.query;
  const filter = {};
  if (!admin) filter.isPublished = true;
  if (type) filter.type = type;
  const [items, total] = await Promise.all([
    Update.find(filter).sort('-publishedAt').skip((page - 1) * limit).limit(limit).populate('job', 'title slug'),
    Update.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
});

export const listUpdates = list(false);
export const adminListUpdates = list(true);

export const createUpdate = asyncHandler(async (req, res) => {
  const update = await Update.create({ ...req.body, job: req.body.job || undefined });
  res.status(201).json({ success: true, data: { update } });
});

export const editUpdate = asyncHandler(async (req, res) => {
  const update = await Update.findById(req.params.id);
  if (!update) throw new ApiError(404, 'Update not found.');
  update.set({ ...req.body, job: req.body.job || undefined });
  await update.save();
  res.json({ success: true, data: { update } });
});

export const deleteUpdate = asyncHandler(async (req, res) => {
  const update = await Update.findByIdAndDelete(req.params.id);
  if (!update) throw new ApiError(404, 'Update not found.');
  res.json({ success: true, message: 'Update deleted.' });
});
