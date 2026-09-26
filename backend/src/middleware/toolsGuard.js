import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { TOOL_LIMITS } from '../config/constants.js';
import { resolvePlan, tierRank, reserveQuota, refundQuota } from '../services/toolsQuota.js';
import { acquireUserSlot, releaseUserSlot } from '../services/concurrency.js';
import { removeFiles } from '../utils/tmpFiles.js';

const human = (s) => (s >= 90 ? `${Math.ceil(s / 60)} minutes` : `${s} second${s === 1 ? '' : 's'}`);

const limitHandler = (message) => (req, res) => {
  const resetAt = req.rateLimit?.resetTime instanceof Date ? req.rateLimit.resetTime.getTime() : Date.now() + 60_000;
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  res.set('Retry-After', String(retryAfter));
  res.status(429).json({ success: false, message: `${message} Please try again in ${human(retryAfter)}.`, code: 'RATE_LIMITED', retryAfter });
};

const base = { standardHeaders: 'draft-7', legacyHeaders: false };

/** Layer 1 - per IP: stops one network from hammering the tool endpoints (100 requests / 10 min). */
export const toolIpLimiter = rateLimit({
  ...base, windowMs: 10 * 60 * 1000, limit: 100, handler: limitHandler('Too many tool requests from your network.'),
});

/** Layer 2 - per user per minute, depends on plan (free 5, pro 20). */
const userLimiters = Object.fromEntries(
  Object.entries(TOOL_LIMITS).map(([tier, l]) => [tier, rateLimit({
    ...base, windowMs: 60 * 1000, limit: l.perMinute, keyGenerator: (req) => `tool:${req.user._id}`,
    handler: limitHandler(`You can use the tools ${l.perMinute} times per minute on your plan.`),
  })])
);
export const toolUserLimiter = (req, res, next) => userLimiters[req.toolPlan](req, res, next);

/** Polling a video job is cheap but frequent, so it gets its own generous limiter. */
export const jobPollLimiter = rateLimit({
  ...base, windowMs: 60 * 1000, limit: 90, keyGenerator: (req) => `poll:${req.user._id}`,
  handler: limitHandler('Checking status too often.'),
});

export const loadPlan = asyncHandler(async (req, res, next) => {
  req.toolPlan = await resolvePlan(req.user);
  req.toolLimits = TOOL_LIMITS[req.toolPlan];
  next();
});

export const requireTier = (min) => (req, res, next) => {
  if (tierRank(req.toolPlan) >= tierRank(min)) return next();
  return next(new ApiError(
    403,
    min === 'annual' ? 'This tool is included in the Annual Aspirant Pass.' : 'This tool is available on the Pro plans.',
    { code: 'UPGRADE_REQUIRED' }
  ));
};

/** Rejects oversized / chunked uploads BEFORE any bytes are stored. */
export const requireUpload = (kind) => (req, res, next) => {
  if (!req.is('multipart/form-data')) return next(new ApiError(415, 'Send the file as multipart/form-data.'));
  const length = Number(req.headers['content-length']);
  if (!Number.isFinite(length) || length <= 0) return next(new ApiError(411, 'Content-Length header is required.'));
  const maxMb = kind === 'video' ? req.toolLimits.maxVideoMb : req.toolLimits.maxTotalMb;
  if (length > (maxMb + 1) * 1024 * 1024) {
    return next(new ApiError(413, `This upload is larger than your plan allows (max ${maxMb} MB).`, { code: 'FILE_TOO_LARGE' }));
  }
  return next();
};

/** At most N requests being processed at the same moment per user. */
export const userConcurrency = (req, res, next) => {
  if (!acquireUserSlot(req.user._id, req.toolLimits.concurrent)) {
    return next(new ApiError(429, 'You already have a file being processed. Please wait for it to finish.', { code: 'RATE_LIMITED' }));
  }
  res.once('close', () => releaseUserSlot(req.user._id));
  return next();
};

/** Daily quota. Reserved up-front, given back automatically when the request fails or is cancelled. */
export const reserve = (kind) => asyncHandler(async (req, res, next) => {
  req.quota = await reserveQuota(req.user._id, kind, req.toolLimits);
  res.once('close', () => {
    if (!res.writableFinished || res.statusCode >= 400) refundQuota(req.quota).catch(() => {});
  });
  next();
});

/** Uploaded temp files are deleted as soon as the response is done (success, error or client abort). */
export const cleanupUploads = (req, res, next) => {
  res.once('close', () => { removeFiles(req.files); });
  next();
};
