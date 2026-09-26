import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env, cookieSecure } from '../config/env.js';
import { DAY_MS } from '../config/constants.js';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { PasswordReset } from '../models/PasswordReset.js';
import { generateOtp, hashOtp, safeEqualHex } from '../utils/otp.js';
import { passwordResetEmail, sendMail } from '../services/mailer.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const COOKIE_NAME = 'rs_refresh';
const COOKIE_PATH = '/api/v1/auth'; // cookie is only ever sent to auth endpoints
const MAX_ATTEMPTS = 5;
const MAX_CODE_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12); // equalises timing for unknown emails

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const cookieOpts = { httpOnly: true, secure: cookieSecure, sameSite: 'lax', path: COOKIE_PATH };

const signAccessToken = (user) =>
  jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: String(user._id), expiresIn: env.ACCESS_TOKEN_TTL, algorithm: 'HS256',
  });

/** Creates a refresh token (rotating), sets the httpOnly cookie and returns a fresh access token. */
export async function issueSession(req, res, user, family = crypto.randomUUID()) {
  const raw = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS);
  await RefreshToken.create({
    user: user._id, tokenHash: sha256(raw), family, expiresAt,
    userAgent: (req.get('user-agent') || '').slice(0, 200), ip: req.ip,
  });
  res.cookie(COOKIE_NAME, raw, { ...cookieOpts, expires: expiresAt });
  return signAccessToken(user);
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists.');
  const user = await User.create({ name, email, password, phone }); // role is never taken from the client
  const accessToken = await issueSession(req, res, user);
  res.status(201).json({ success: true, data: { user, accessToken } });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password +failedLoginAttempts +lockUntil');

  if (user?.lockUntil && user.lockUntil > new Date()) {
    throw new ApiError(423, 'Too many failed attempts. Account locked for 15 minutes.', { code: 'ACCOUNT_LOCKED' });
  }

  let valid = false;
  if (user) valid = await user.comparePassword(password);
  else await bcrypt.compare(password, DUMMY_HASH);

  if (!valid) {
    if (user) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_MS);
        user.failedLoginAttempts = 0;
      }
      await user.save();
    }
    throw new ApiError(401, 'Invalid email or password.'); // same message for both cases (no user enumeration)
  }
  if (!user.isActive) throw new ApiError(403, 'Your account has been disabled. Contact support.', { code: 'ACCOUNT_DISABLED' });

  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = await issueSession(req, res, user);
  res.json({ success: true, data: { user, accessToken } });
});

export const refresh = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) throw new ApiError(401, 'No active session.', { code: 'NO_REFRESH' });

  const doc = await RefreshToken.findOne({ tokenHash: sha256(raw) });
  if (!doc) throw new ApiError(401, 'Session expired. Please log in again.', { code: 'NO_REFRESH' });

  if (doc.revokedAt) {
    // Token reuse detected -> assume theft, kill every session in this family.
    await RefreshToken.updateMany({ family: doc.family, revokedAt: { $exists: false } }, { revokedAt: new Date() });
    res.clearCookie(COOKIE_NAME, cookieOpts);
    throw new ApiError(401, 'Session invalidated. Please log in again.', { code: 'TOKEN_REUSE' });
  }
  if (doc.expiresAt < new Date()) throw new ApiError(401, 'Session expired. Please log in again.', { code: 'NO_REFRESH' });

  const user = await User.findById(doc.user);
  if (!user || !user.isActive) throw new ApiError(401, 'Session expired. Please log in again.', { code: 'NO_REFRESH' });

  doc.revokedAt = new Date();
  await doc.save();
  const accessToken = await issueSession(req, res, user, doc.family); // rotation
  res.json({ success: true, data: { user, accessToken } });
});

export const logout = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[COOKIE_NAME];
  if (raw) await RefreshToken.updateOne({ tokenHash: sha256(raw), revokedAt: { $exists: false } }, { revokedAt: new Date() });
  res.clearCookie(COOKIE_NAME, cookieOpts);
  res.json({ success: true, message: 'Logged out.' });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

// ---------------------------------------------------------------- forgot / reset password (email code)
const GENERIC_FORGOT = 'If an account exists for this email, a 6-digit code has been sent. It is valid for %MIN% minutes.';

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (user && user.isActive) {
    const existing = await PasswordReset.findOne({ user: user._id }).select('lastSentAt');
    const tooSoon = existing && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS;
    if (!tooSoon) {
      const code = generateOtp();
      const now = Date.now();
      await PasswordReset.findOneAndUpdate(
        { user: user._id },
        { codeHash: hashOtp(user._id, code, env.JWT_ACCESS_SECRET), expiresAt: new Date(now + env.RESET_CODE_MINUTES * 60_000), attempts: 0, lastSentAt: new Date(now) },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      // Sent in the background so the response time is the same whether or not the account exists.
      sendMail({ to: user.email, ...passwordResetEmail({ name: user.name, code, minutes: env.RESET_CODE_MINUTES }) })
        .catch((err) => console.error('Password reset email failed:', err.message));
    }
  }
  // Always the same answer: never reveal which emails are registered.
  res.json({ success: true, message: GENERIC_FORGOT.replace('%MIN%', String(env.RESET_CODE_MINUTES)) });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, code, newPassword } = req.body;
  const invalid = () => new ApiError(400, 'Invalid or expired code.', { code: 'INVALID_CODE' });

  const user = await User.findOne({ email });
  if (!user || !user.isActive) throw invalid();

  // Atomic attempt counter: parallel guesses cannot exceed the limit.
  const rec = await PasswordReset.findOneAndUpdate(
    { user: user._id, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_CODE_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { new: true }
  );
  if (!rec) {
    const stale = await PasswordReset.findOne({ user: user._id }).select('attempts');
    if (stale && stale.attempts >= MAX_CODE_ATTEMPTS) {
      await PasswordReset.deleteOne({ user: user._id });
      throw new ApiError(429, 'Too many wrong attempts. Please request a new code.', { code: 'CODE_LOCKED' });
    }
    throw invalid();
  }
  if (!safeEqualHex(rec.codeHash, hashOtp(user._id, code, env.JWT_ACCESS_SECRET))) throw invalid();

  user.password = newPassword; // hashed by the pre-save hook, which also stamps passwordChangedAt
  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();
  await PasswordReset.deleteOne({ user: user._id }); // one-time use
  await RefreshToken.updateMany({ user: user._id, revokedAt: { $exists: false } }, { revokedAt: new Date() }); // sign out everywhere
  res.json({ success: true, message: 'Password updated. Please log in with your new password.' });
});
