import rateLimit from 'express-rate-limit';

const make = (windowMs, limit, message) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message } });

export const globalLimiter = make(15 * 60 * 1000, 600, 'Too many requests. Please try again in a few minutes.');
export const authLimiter = make(15 * 60 * 1000, 30, 'Too many login attempts. Please try again in 15 minutes.');
export const applyLimiter = make(60 * 60 * 1000, 40, 'Too many applications submitted. Please try again later.');

// Password reset: strict, because each request can send an email and each guess tests a code.
export const forgotIpLimiter = make(60 * 60 * 1000, 8, 'Too many reset requests from your network. Please try again in an hour.');
export const forgotEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 3, standardHeaders: 'draft-7', legacyHeaders: false,
  keyGenerator: (req) => `forgot:${req.body?.email || 'none'}`, // max 3 codes per email per hour, whoever asks
  message: { success: false, message: 'Too many reset requests for this email. Please try again in an hour.' },
});
export const resetLimiter = make(15 * 60 * 1000, 10, 'Too many attempts. Please try again in 15 minutes.');
export const paymentLimiter = make(60 * 60 * 1000, 40, 'Too many payment attempts. Please try again in a while.');
