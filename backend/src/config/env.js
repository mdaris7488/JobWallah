import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(5000),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_SECURE: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['true', 'false']).optional()),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().default(587)),
  SMTP_SECURE: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['true', 'false']).optional()),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('JobWallah <no-reply@jobwallah.in>'),
  RESET_CODE_MINUTES: z.coerce.number().int().min(5).max(60).default(10),
  TOOLS_TMP_DIR: z.string().optional(),
  FFMPEG_PATH: z.string().optional(),
  // Set to "true" to turn the video compressor off (saves server CPU/RAM on cheap hosting). Everything else keeps working.
  DISABLE_VIDEO_TOOL: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['true', 'false']).default('false')),
  PAYMENT_MODE: z.enum(['demo', 'razorpay']).default('demo'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_API_BASE: z.string().url().default('https://api.razorpay.com'),
  SEED_ADMIN_NAME: z.string().default('JobWallah Admin'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@jobwallah.in'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin@12345'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
if (env.NODE_ENV === 'production' && !env.SMTP_HOST) {
  console.warn('⚠️  SMTP_HOST is not set: password reset emails cannot be sent in production.');
}
if (env.PAYMENT_MODE === 'razorpay') {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    console.error('❌ PAYMENT_MODE=razorpay needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env');
    process.exit(1);
  }
  if (!env.RAZORPAY_WEBHOOK_SECRET) console.warn('⚠️  RAZORPAY_WEBHOOK_SECRET is not set: the webhook is disabled (payments still work through the checkout callback).');
} else if (env.NODE_ENV === 'production') {
  console.warn('⚠️  PAYMENT_MODE=demo in production: anyone can activate paid plans WITHOUT paying. Set PAYMENT_MODE=razorpay before going live.');
}
export const isProd = env.NODE_ENV === 'production';
export const cookieSecure = env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProd;
