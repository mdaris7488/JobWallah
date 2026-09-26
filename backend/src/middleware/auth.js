import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const extractToken = (req) => {
  const header = req.headers.authorization;
  return header && header.startsWith('Bearer ') ? header.slice(7).trim() : null;
};

async function resolveUser(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw new ApiError(401, 'Session expired. Please log in again.', { code: 'TOKEN_INVALID' });
  }
  const user = await User.findById(decoded.sub).select('+passwordChangedAt');
  if (!user) throw new ApiError(401, 'Account no longer exists.', { code: 'TOKEN_INVALID' });
  if (!user.isActive) throw new ApiError(403, 'Your account has been disabled. Contact support.', { code: 'ACCOUNT_DISABLED' });
  if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
    throw new ApiError(401, 'Password changed. Please log in again.', { code: 'TOKEN_INVALID' });
  }
  return user;
}

/** Requires a valid access token. */
export const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw new ApiError(401, 'Authentication required.', { code: 'NO_TOKEN' });
  req.user = await resolveUser(token);
  next();
});

/** Attaches req.user when a valid token is present, otherwise continues as guest. */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (token) {
    try { req.user = await resolveUser(token); } catch { /* treat as guest */ }
  }
  next();
});

export const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ApiError(403, 'You do not have permission to perform this action.'));
  }
  next();
};
