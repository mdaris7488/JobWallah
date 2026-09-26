import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { TOOLS_DIR, removeFile } from '../utils/tmpFiles.js';
import { videoPool } from './concurrency.js';
import { refundQuota } from './toolsQuota.js';

/**
 * Video compression = CPU heavy, so it runs as a background JOB:
 *   POST /tools/video/compress  -> 202 { jobId }
 *   GET  /tools/jobs/:id        -> { status, progress }
 *   GET  /tools/jobs/:id/download
 * Guard rails: bounded queue, per-user job limit, wall-clock timeout (ffmpeg is killed), magic-byte check,
 * ffmpeg started WITHOUT a shell and with a protocol whitelist (an uploaded file cannot make ffmpeg fetch URLs).
 * NOTE: job state is in memory -> run a single API instance (or move jobs to Redis/BullMQ when you scale out).
 */
const jobs = new Map();
const activeChildren = new Set();
const JOB_TTL_MS = 15 * 60 * 1000;

let ffmpegBinary; // undefined = not resolved yet, null = not available
async function getFfmpeg() {
  if (ffmpegBinary !== undefined) return ffmpegBinary;
  if (env.FFMPEG_PATH) { ffmpegBinary = env.FFMPEG_PATH; return ffmpegBinary; }
  try {
    const mod = await import('ffmpeg-static');
    ffmpegBinary = mod.default || null;
  } catch {
    ffmpegBinary = null;
  }
  return ffmpegBinary;
}
export const killAllFfmpeg = () => { for (const c of activeChildren) c.kill('SIGKILL'); };
export const isVideoAvailable = async () => env.DISABLE_VIDEO_TOOL !== 'true' && Boolean(await getFfmpeg());

function runFfmpeg(bin, args, { timeoutMs, onTime } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: false });
    let stderr = '';
    let buffer = '';
    let timedOut = false;
    activeChildren.add(child);
    const timer = timeoutMs ? setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs) : null;

    child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-8000); });
    child.stdout.on('data', (d) => {
      buffer += d;
      let idx = buffer.indexOf('\n');
      while (idx >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        const m = /^out_time_(?:us|ms)=(\d+)/.exec(line);
        if (m && onTime) onTime(Number(m[1]) / 1_000_000);
        idx = buffer.indexOf('\n');
      }
    });
    child.on('error', (err) => {
      activeChildren.delete(child);
      if (timer) clearTimeout(timer);
      reject(err.code === 'ENOENT' ? new ApiError(503, 'Video compression is not available on this server.') : err);
    });
    child.on('close', (code) => { activeChildren.delete(child); if (timer) clearTimeout(timer); resolve({ code, stderr, timedOut }); });
  });
}

async function probe(bin, input) {
  const { stderr } = await runFfmpeg(bin, ['-hide_banner', '-nostdin', '-protocol_whitelist', 'file', '-i', input], { timeoutMs: 20_000 });
  const dur = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  const seconds = dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0;
  const dims = /Video:[^\n]*?[ ,](\d{2,5})x(\d{2,5})[ ,\[]/.exec(stderr);
  return {
    seconds,
    hasVideo: /Stream #\d+:\d+[^\n]*Video:/.test(stderr),
    hasAudio: /Stream #\d+:\d+[^\n]*Audio:/.test(stderr),
    width: dims ? Number(dims[1]) : 0,
    height: dims ? Number(dims[2]) : 0,
  };
}

const pickAutoHeight = (videoKbps) => (videoKbps >= 2500 ? 1080 : videoKbps >= 1200 ? 720 : videoKbps >= 500 ? 480 : 360);

async function compress(job, bin) {
  const { limits } = job;
  const started = Date.now();
  const totalBudget = limits.videoTimeoutMin * 60_000;

  const info = await probe(bin, job.inputPath);
  if (!info.hasVideo || !info.seconds) throw new ApiError(422, 'Could not read this video. The file may be damaged or unsupported.');
  if (info.seconds > limits.maxVideoMinutes * 60) {
    throw new ApiError(413, `Video is too long for your plan (max ${limits.maxVideoMinutes} minutes).`, { code: 'FILE_TOO_LARGE' });
  }
  if (job.targetBytes >= job.originalBytes) {
    throw new ApiError(422, 'Your video is already smaller than the size you asked for.', { code: 'ALREADY_SMALLER' });
  }

  let audioKbps = info.hasAudio ? 96 : 0;
  const totalKbps = ((job.targetBytes * 8) / info.seconds / 1000) * 0.93; // 7% headroom for container overhead
  let videoKbps = Math.floor(totalKbps - audioKbps);
  if (videoKbps < 80 && audioKbps) { audioKbps = 48; videoKbps = Math.floor(totalKbps - audioKbps); }
  if (videoKbps < 40) {
    throw new ApiError(422, 'This size is too small for a video of this length. Please choose a larger size.', { code: 'TARGET_NOT_REACHABLE' });
  }

  let attempt = 0;
  let lastPath = null;
  let result = null;
  while (attempt < 2) {
    attempt += 1;
    const remaining = totalBudget - (Date.now() - started);
    if (remaining < 10_000) throw new ApiError(408, 'Processing took too long. Try a shorter video.');

    const wanted = job.resolution === 'auto' ? pickAutoHeight(videoKbps) : Number(job.resolution);
    const useHeight = info.height && wanted < info.height ? wanted : 0; // never upscale
    const outPath = path.join(TOOLS_DIR, `${job.id}-${attempt}.mp4`);
    const args = [
      '-hide_banner', '-nostdin', '-y', '-protocol_whitelist', 'file', '-i', job.inputPath,
      '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn', '-map_metadata', '-1',
      ...(useHeight ? ['-vf', `scale=-2:${useHeight}`] : []),
      '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', `${videoKbps}k`, '-maxrate', `${Math.round(videoKbps * 1.4)}k`,
      '-bufsize', `${videoKbps * 2}k`, '-pix_fmt', 'yuv420p', '-threads', '2',
      '-c:a', 'aac', '-b:a', `${audioKbps || 96}k`, '-ac', '2',
      '-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', outPath,
    ];
    const onTime = (t) => { job.progress = Math.max(job.progress, Math.min(99, Math.round((t / info.seconds) * 100))); };
    const { code, stderr, timedOut } = await runFfmpeg(bin, args, { timeoutMs: remaining, onTime });
    if (timedOut) { await removeFile(outPath); throw new ApiError(408, 'Processing took too long. Try a shorter video or a larger size.'); }
    if (code !== 0) {
      await removeFile(outPath);
      console.error('ffmpeg failed:', stderr.slice(-600));
      throw new ApiError(422, 'Could not process this video. The file may be damaged or use an unsupported format.');
    }

    const { size } = await fsp.stat(outPath);
    if (lastPath) await removeFile(lastPath);
    lastPath = outPath;
    result = { path: outPath, bytes: size, targetMet: size <= job.targetBytes };
    if (result.targetMet) break;
    // Overshot: lower the bitrate proportionally and try once more.
    videoKbps = Math.floor(videoKbps * (job.targetBytes / size) * 0.92);
    if (videoKbps < 30) break;
  }
  return result;
}

async function runJob(job) {
  try {
    const bin = await getFfmpeg();
    if (!bin) throw new ApiError(503, 'Video compression is not available on this server.');
    await videoPool.run(async () => {
      job.status = 'running';
      job.result = await compress(job, bin);
    });
    job.progress = 100;
    job.status = 'done';
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof ApiError ? err.message : 'Video processing failed. Please try again.';
    job.errorCode = err instanceof ApiError ? err.appCode : undefined;
    if (!(err instanceof ApiError)) console.error('Video job crashed:', err);
    await refundQuota(job.quota).catch(() => {});
  } finally {
    await removeFile(job.inputPath); // the upload is never kept
    job.finishedAt = Date.now();
  }
}

export async function createVideoJob({ userId, inputPath, originalName, originalBytes, targetBytes, resolution, limits, quota }) {
  if (!(await isVideoAvailable())) throw new ApiError(503, 'Video compression is temporarily unavailable on this server.');
  const mine = [...jobs.values()].filter((j) => j.userId === String(userId) && ['queued', 'running'].includes(j.status)).length;
  if (mine >= limits.concurrent) throw new ApiError(429, 'You already have a video being processed. Wait for it to finish.', { code: 'RATE_LIMITED' });
  if (videoPool.isFull) throw new ApiError(503, 'Our servers are busy right now. Please try again in a minute.', { code: 'SERVER_BUSY' });

  const job = {
    id: crypto.randomUUID(), userId: String(userId), status: 'queued', progress: 0, inputPath, originalName,
    originalBytes, targetBytes, resolution, limits, quota, result: null, error: null, createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  runJob(job); // fire and forget - state is tracked on the job object
  return job;
}

export function getJobFor(userId, id) {
  const job = jobs.get(id);
  if (!job || job.userId !== String(userId)) throw new ApiError(404, 'Job not found or expired.');
  return job;
}

export const publicJob = (job) => ({
  id: job.id, status: job.status, progress: job.progress, error: job.error, errorCode: job.errorCode,
  originalBytes: job.originalBytes, resultBytes: job.result?.bytes, targetMet: job.result?.targetMet,
});

export function startJobSweeper() {
  const timer = setInterval(async () => {
    const now = Date.now();
    for (const [id, job] of jobs) {
      const finished = job.finishedAt && now - job.finishedAt > JOB_TTL_MS;
      const stuck = !job.finishedAt && now - job.createdAt > 2 * 60 * 60 * 1000;
      if (finished || stuck) {
        if (job.result?.path) await removeFile(job.result.path);
        await removeFile(job.inputPath);
        jobs.delete(id);
      }
    }
  }, 60_000);
  timer.unref();
  return timer;
}
