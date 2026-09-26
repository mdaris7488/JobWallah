import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';

// multipart form fields arrive as strings; empty strings mean "not set".
const blank = (v) => (v === '' || v === undefined || v === null ? undefined : v);
const optInt = (min, max) => z.preprocess(blank, z.coerce.number().int().min(min).max(max).optional());
const optNum = (min, max) => z.preprocess(blank, z.coerce.number().min(min).max(max).optional());

export const compressSchema = z.object({
  targetKb: z.coerce.number().min(5, 'Minimum target is 5 KB').max(20480, 'Maximum target is 20 MB'),
  format: z.enum(['jpeg', 'webp']).default('jpeg'),
});

export const resizeSchema = z.object({
  mode: z.enum(['dimensions', 'percent']).default('dimensions'),
  width: optInt(1, 10000),
  height: optInt(1, 10000),
  percent: optInt(1, 500),
  fit: z.enum(['inside', 'cover', 'fill']).default('inside'),
  format: z.enum(['same', 'jpeg', 'png', 'webp', 'avif']).default('same'),
  quality: optInt(30, 100),
}).superRefine((v, ctx) => {
  if (v.mode === 'percent' && !v.percent) ctx.addIssue({ code: 'custom', path: ['percent'], message: 'Enter a percentage' });
  if (v.mode === 'dimensions' && !v.width && !v.height) ctx.addIssue({ code: 'custom', path: ['width'], message: 'Enter a width or a height' });
});

export const convertSchema = z.object({
  format: z.enum(['jpeg', 'png', 'webp', 'avif']),
  quality: optInt(30, 100),
});

export const examPhotoSchema = z.object({
  width: z.coerce.number().int().min(20).max(3000),
  height: z.coerce.number().int().min(20).max(3000),
  maxKb: z.coerce.number().min(5).max(1024),
  fit: z.enum(['cover', 'inside']).default('cover'),
});

export const fromImagesSchema = z.object({
  pageSize: z.enum(['a4', 'fit']).default('a4'),
  margin: z.enum(['none', 'small', 'medium']).default('small'),
  orientation: z.enum(['auto', 'portrait', 'landscape']).default('auto'),
});

export const extractSchema = z.object({
  ranges: z.string().trim().min(1, 'Enter the pages to keep, e.g. 1-3, 5').max(300),
});

export const videoSchema = z.object({
  targetMb: z.coerce.number().min(0.5, 'Minimum target is 0.5 MB').max(500),
  resolution: z.enum(['auto', '1080', '720', '480', '360']).default('auto'),
});

export const jobIdParam = z.object({ id: z.string().uuid() });

export function parseOpts(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw new ApiError(400, 'Validation failed', {
      errors: result.error.issues.map((i) => ({ field: i.path.join('.') || 'body', message: i.message })),
    });
  }
  return result.data;
}
