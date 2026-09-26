import os from 'node:os';
import sharp from 'sharp';
import { ApiError } from '../utils/ApiError.js';

// Keep memory/CPU predictable on a shared server.
sharp.cache(false);
sharp.concurrency(Math.max(1, Math.min(2, os.cpus().length)));

const MAX_INPUT_PIXELS = 50_000_000; // ~50 MP: blocks "decompression bomb" images
const SHARP_OPTS = { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' };
const ALLOWED_INPUT = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'tiff']); // SVG/PDF/etc. are rejected on purpose
const WORKING_MAX_DIM = 4096;

export const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' };
export const EXT = { jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif' };

/** Verifies the REAL file content (mimetype/extension can be faked by the client). */
export async function inspectImage(input) {
  let meta;
  try {
    meta = await sharp(input, SHARP_OPTS).metadata();
  } catch (err) {
    const tooBig = /pixel limit/i.test(String(err.message));
    throw new ApiError(tooBig ? 413 : 400, tooBig ? 'This image has too many pixels (max 50 megapixels).' : 'This file is not a valid or supported image.');
  }
  if (!ALLOWED_INPUT.has(meta.format)) throw new ApiError(415, 'Unsupported image type. Use JPG, PNG, WebP, GIF, AVIF or TIFF.');
  return meta;
}

const sameFormat = (fmt) => (fmt === 'gif' ? 'png' : fmt === 'tiff' ? 'jpeg' : fmt); // gif -> first frame as png

function encode(img, format, quality) {
  switch (format) {
    case 'jpeg': return img.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true }).toBuffer();
    case 'webp': return img.webp({ quality, effort: 3 }).toBuffer();
    case 'avif': return img.avif({ quality, effort: 2 }).toBuffer();
    case 'png': return img.png({ compressionLevel: 9 }).toBuffer();
    default: throw new ApiError(400, 'Unsupported output format.');
  }
}

/** Decode once into raw pixels (auto-rotated, sRGB, bounded size) so repeated encodes are cheap. */
async function loadWorking(input, maxDim = WORKING_MAX_DIM) {
  const { data, info } = await sharp(input, SHARP_OPTS)
    .rotate() // apply EXIF orientation, EXIF is dropped afterwards
    .resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true })
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

const fromWorking = (w, scale = 1) => {
  let img = sharp(w.data, { raw: { width: w.width, height: w.height, channels: w.channels } });
  if (scale < 1) img = img.resize({ width: Math.max(1, Math.round(w.width * scale)), kernel: 'lanczos3' });
  return img;
};

/**
 * Compress an image so that it is <= targetBytes.
 *  1) keep the size, lower the quality (binary search for the highest quality that fits)
 *  2) if even the minimum quality is too big, shrink dimensions step by step
 * With `fixed` ({width,height,fit}) the pixel size is fixed and only quality is used (exam photos).
 */
export async function compressToTarget(input, { targetBytes, format = 'jpeg', minQuality = 40, fixed = null }) {
  await inspectImage(input);
  let working;
  if (fixed) {
    const { data, info } = await sharp(input, SHARP_OPTS).rotate().toColourspace('srgb')
      .resize({ width: fixed.width, height: fixed.height, fit: fixed.fit || 'cover', background: '#ffffff' })
      .flatten({ background: '#ffffff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    working = { data, width: info.width, height: info.height, channels: info.channels };
  } else {
    working = await loadWorking(input);
  }

  const q = (scale, quality) => encode(fromWorking(working, scale), format, quality);
  const floorQuality = fixed ? 10 : minQuality;
  let scale = 1;
  let best = null;
  let smallest = null;

  for (let step = 0; step < 12; step += 1) {
    const atMin = await q(scale, floorQuality);
    if (!smallest || atMin.length < smallest.buffer.length) smallest = { buffer: atMin, quality: floorQuality, scale };

    if (atMin.length <= targetBytes) {
      // it fits at the floor quality -> find the highest quality that still fits
      let lo = floorQuality + 1;
      let hi = 95;
      best = { buffer: atMin, quality: floorQuality, scale };
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const buf = await q(scale, mid);
        if (buf.length <= targetBytes) { best = { buffer: buf, quality: mid, scale }; lo = mid + 1; } else hi = mid - 1;
      }
      break;
    }
    if (fixed) break; // cannot change pixel size
    if (Math.round(working.width * scale) <= 48 || Math.round(working.height * scale) <= 48) break;
    scale *= Math.min(0.9, Math.max(0.5, Math.sqrt(targetBytes / atMin.length) * 0.92));
  }

  const chosen = best || smallest;
  const w = Math.max(1, Math.round(working.width * chosen.scale));
  const h = Math.max(1, Math.round(working.height * chosen.scale));
  return { buffer: chosen.buffer, format, quality: chosen.quality, width: w, height: h, targetMet: !!best };
}

/** Resize by dimensions or percent. */
export async function resizeImage(input, { mode, width, height, percent, fit = 'inside', format = 'same', quality = 85 }) {
  const meta = await inspectImage(input);
  const rotated = (meta.orientation || 1) >= 5;
  const srcW = rotated ? meta.height : meta.width;
  const srcH = rotated ? meta.width : meta.height;

  let outW; let outH;
  if (mode === 'percent') {
    outW = Math.round((srcW * percent) / 100);
    outH = Math.round((srcH * percent) / 100);
  } else if (width && height) {
    outW = width; outH = height;
  } else if (width) {
    outW = width; outH = Math.round((srcH * width) / srcW);
  } else if (height) {
    outH = height; outW = Math.round((srcW * height) / srcH);
  } else {
    throw new ApiError(400, 'Enter a width, a height, or a percentage.');
  }
  outW = Math.max(1, outW); outH = Math.max(1, outH);
  if (outW > 10000 || outH > 10000 || outW * outH > MAX_INPUT_PIXELS) {
    throw new ApiError(400, 'The requested size is too large (max 10000 px per side and 50 megapixels).');
  }

  const outFormat = format === 'same' ? sameFormat(meta.format) : format;
  const img = sharp(input, SHARP_OPTS).rotate().toColourspace('srgb')
    .resize({ width: outW, height: outH, fit: mode === 'percent' ? 'fill' : fit, background: '#ffffff', kernel: 'lanczos3' });
  const buffer = await encode(img, outFormat, quality);
  return { buffer, format: outFormat, width: outW, height: outH };
}

export async function convertImage(input, { format, quality = 85 }) {
  const meta = await inspectImage(input);
  const img = sharp(input, SHARP_OPTS).rotate().toColourspace('srgb');
  const buffer = await encode(img, format, quality);
  return { buffer, format, width: meta.width, height: meta.height };
}

/** Image -> JPEG buffer that is safe to embed in a PDF (flattened, bounded size, EXIF removed). */
export async function toPdfJpeg(input) {
  await inspectImage(input);
  const { data, info } = await sharp(input, SHARP_OPTS).rotate().toColourspace('srgb')
    .resize({ width: 4000, height: 4000, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
