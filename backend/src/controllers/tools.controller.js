import path from 'node:path';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { TOOL_CATALOG, TOOL_LIMITS } from '../config/constants.js';
import { createZip } from '../utils/zipStore.js';
import { isPdfFile, isVideoFile } from '../utils/fileSniff.js';
import { removeFiles } from '../utils/tmpFiles.js';
import { cpuPool } from '../services/concurrency.js';
import { getUsage, resolvePlan } from '../services/toolsQuota.js';
import { compressToTarget, convertImage, resizeImage, EXT, MIME } from '../services/imageTools.js';
import { extractPages, imagesToPdf, mergePdfs } from '../services/pdfTools.js';
import { createVideoJob, getJobFor, isVideoAvailable, publicJob } from '../services/videoService.js';
import {
  compressSchema, convertSchema, examPhotoSchema, extractSchema, fromImagesSchema, parseOpts, resizeSchema, videoSchema,
} from '../validators/toolSchemas.js';

const MB = 1024 * 1024;

// ------------------------------------------------------------------ helpers
const baseName = (name) =>
  path.parse(String(name || 'file')).name.replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'file';

function assertUploads(req, { min = 1, max, perFileMb }) {
  const files = req.files || [];
  if (files.length < min) throw new ApiError(400, min > 1 ? `Please select at least ${min} files.` : 'Please choose a file first.');
  if (files.length > max) {
    throw new ApiError(
      403,
      max === 1 ? 'Your plan processes 1 file at a time. Upgrade to Pro for batch processing (up to 20 files).' : `Your plan allows up to ${max} files at a time.`,
      { code: 'UPGRADE_REQUIRED' }
    );
  }
  for (const f of files) {
    if (f.size > perFileMb * MB) {
      throw new ApiError(413, `"${f.originalname}" is larger than ${perFileMb} MB, the limit of your plan.`, { code: 'FILE_TOO_LARGE' });
    }
  }
  return files;
}

function send(res, outputs, { targetMet = true } = {}) {
  let body; let name; let mime;
  if (outputs.length === 1) {
    ({ buffer: body, name, mime } = outputs[0]);
  } else {
    const used = new Set();
    const entries = outputs.map((o) => {
      let n = o.name; let i = 2;
      while (used.has(n)) { const p = path.parse(o.name); n = `${p.name}-${i}${p.ext}`; i += 1; }
      used.add(n);
      return { name: n, data: new Uint8Array(o.buffer) };
    });
    body = Buffer.from(createZip(entries));
    name = 'jobwallah-files.zip';
    mime = 'application/zip';
  }
  res.set({
    'Content-Type': mime,
    'Content-Disposition': `attachment; filename="${name}"`,
    'Content-Length': String(body.length),
    'Cache-Control': 'no-store',
    'X-Original-Bytes': String(outputs.reduce((n, o) => n + (o.originalBytes || 0), 0)),
    'X-Result-Bytes': String(body.length),
    'X-Result-Count': String(outputs.length),
    'X-Target-Met': String(targetMet),
  });
  res.end(body);
}

const imageOut = (file, suffix, r) => ({
  name: `${baseName(file.originalname)}${suffix}.${EXT[r.format]}`, buffer: r.buffer, mime: MIME[r.format], originalBytes: file.size,
});

// ------------------------------------------------------------------ config / usage
export const toolsConfig = asyncHandler(async (req, res) => {
  let plan = null; let usage = null;
  if (req.user) { plan = await resolvePlan(req.user); usage = await getUsage(req.user._id); }
  res.json({
    success: true,
    data: {
      plan, usage, limits: TOOL_LIMITS[plan || 'free'], limitsByTier: TOOL_LIMITS,
      tools: TOOL_CATALOG, videoAvailable: await isVideoAvailable(),
    },
  });
});

// ------------------------------------------------------------------ image tools
export const compressImages = asyncHandler(async (req, res) => {
  const opts = parseOpts(compressSchema, req.body);
  const { toolLimits: l } = req;
  const files = assertUploads(req, { max: l.maxFiles, perFileMb: l.maxImageMb });
  const targetBytes = Math.round(opts.targetKb * 1024);
  const results = await cpuPool.run(async () => {
    const out = [];
    for (const f of files) {
      const r = await compressToTarget(f.path, { targetBytes, format: opts.format });
      out.push({ ...imageOut(f, '-compressed', r), targetMet: r.targetMet });
    }
    return out;
  });
  send(res, results, { targetMet: results.every((r) => r.targetMet) });
});

export const resizeImages = asyncHandler(async (req, res) => {
  const opts = parseOpts(resizeSchema, req.body);
  const { toolLimits: l } = req;
  const files = assertUploads(req, { max: l.maxFiles, perFileMb: l.maxImageMb });
  const results = await cpuPool.run(async () => {
    const out = [];
    for (const f of files) out.push(imageOut(f, '-resized', await resizeImage(f.path, { ...opts, quality: opts.quality ?? 85 })));
    return out;
  });
  send(res, results);
});

export const convertImages = asyncHandler(async (req, res) => {
  const opts = parseOpts(convertSchema, req.body);
  const { toolLimits: l } = req;
  const files = assertUploads(req, { max: l.maxFiles, perFileMb: l.maxImageMb });
  const results = await cpuPool.run(async () => {
    const out = [];
    for (const f of files) out.push(imageOut(f, '', await convertImage(f.path, { format: opts.format, quality: opts.quality ?? 85 })));
    return out;
  });
  send(res, results);
});

export const examPhoto = asyncHandler(async (req, res) => {
  const opts = parseOpts(examPhotoSchema, req.body);
  const { toolLimits: l } = req;
  const files = assertUploads(req, { max: l.maxFiles, perFileMb: l.maxImageMb });
  const results = await cpuPool.run(async () => {
    const out = [];
    for (const f of files) {
      const r = await compressToTarget(f.path, {
        targetBytes: Math.round(opts.maxKb * 1024), format: 'jpeg', fixed: { width: opts.width, height: opts.height, fit: opts.fit },
      });
      if (!r.targetMet) {
        throw new ApiError(422, `Could not fit "${f.originalname}" in ${opts.maxKb} KB at ${opts.width}x${opts.height} px. Increase the KB limit or reduce the size.`, { code: 'TARGET_NOT_REACHABLE' });
      }
      out.push(imageOut(f, `-${opts.width}x${opts.height}`, r));
    }
    return out;
  });
  send(res, results);
});

// ------------------------------------------------------------------ PDF tools
export const imagesToPdfCtl = asyncHandler(async (req, res) => {
  const opts = parseOpts(fromImagesSchema, req.body);
  const { toolLimits: l } = req;
  const files = assertUploads(req, { max: l.maxPdfImages, perFileMb: l.maxImageMb });
  const buffer = await cpuPool.run(() => imagesToPdf(files.map((f) => f.path), opts));
  send(res, [{ name: `${baseName(files[0].originalname)}.pdf`, buffer, mime: 'application/pdf', originalBytes: files.reduce((n, f) => n + f.size, 0) }]);
});

export const mergePdfCtl = asyncHandler(async (req, res) => {
  const { toolLimits: l } = req;
  const files = assertUploads(req, { min: 2, max: l.maxFiles, perFileMb: l.maxPdfMb });
  for (const f of files) if (!(await isPdfFile(f.path))) throw new ApiError(400, `"${f.originalname}" is not a valid PDF.`);
  const { buffer } = await cpuPool.run(() => mergePdfs(files.map((f) => f.path), { maxPages: l.maxPdfPages }));
  send(res, [{ name: 'merged.pdf', buffer, mime: 'application/pdf', originalBytes: files.reduce((n, f) => n + f.size, 0) }]);
});

export const extractPdfCtl = asyncHandler(async (req, res) => {
  const opts = parseOpts(extractSchema, req.body);
  const { toolLimits: l } = req;
  const [file] = assertUploads(req, { max: 1, perFileMb: l.maxPdfMb });
  if (!(await isPdfFile(file.path))) throw new ApiError(400, 'This file is not a valid PDF.');
  const { buffer } = await cpuPool.run(() => extractPages(file.path, opts.ranges, { maxPages: l.maxPdfPages }));
  send(res, [{ name: `${baseName(file.originalname)}-pages.pdf`, buffer, mime: 'application/pdf', originalBytes: file.size }]);
});

// ------------------------------------------------------------------ video (background job)
export const startVideo = asyncHandler(async (req, res) => {
  try {
    const opts = parseOpts(videoSchema, req.body);
    const { toolLimits: l } = req;
    const [file] = assertUploads(req, { max: 1, perFileMb: l.maxVideoMb });
    if (!(await isVideoFile(file.path))) throw new ApiError(400, 'This file is not a supported video (MP4, MOV, WebM, MKV, AVI).');
    const job = await createVideoJob({
      userId: req.user._id, inputPath: file.path, originalName: file.originalname, originalBytes: file.size,
      targetBytes: Math.round(opts.targetMb * MB), resolution: opts.resolution, limits: l, quota: req.quota,
    });
    res.status(202).json({ success: true, data: { jobId: job.id } });
  } catch (err) {
    await removeFiles(req.files); // the job never started, so nobody else will delete the upload
    throw err;
  }
});

export const videoStatus = asyncHandler(async (req, res) => {
  res.json({ success: true, data: publicJob(getJobFor(req.user._id, req.params.id)) });
});

export const videoDownload = asyncHandler(async (req, res) => {
  const job = getJobFor(req.user._id, req.params.id);
  if (job.status !== 'done' || !job.result?.path) throw new ApiError(409, 'This video is not ready yet.');
  res.set({ 'Cache-Control': 'no-store', 'X-Original-Bytes': String(job.originalBytes), 'X-Result-Bytes': String(job.result.bytes), 'X-Target-Met': String(job.result.targetMet) });
  res.download(path.resolve(job.result.path), `${baseName(job.originalName)}-compressed.mp4`);
});
