import crypto from 'node:crypto';

/** 6-digit numeric code from a CSPRNG (leading zeros kept). */
export const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

/** Only a keyed hash of the code is stored, so a leaked database does not leak usable codes. */
export const hashOtp = (userId, code, secret) =>
  crypto.createHmac('sha256', secret).update(`${userId}:${code}`).digest('hex');

export const safeEqualHex = (a, b) => {
  const x = Buffer.from(String(a), 'hex');
  const y = Buffer.from(String(b), 'hex');
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};
