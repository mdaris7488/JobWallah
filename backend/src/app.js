import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import mongoose from 'mongoose';
import { env, isProd } from './config/env.js';
import { globalLimiter } from './middleware/rateLimiters.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { ApiError } from './utils/ApiError.js';
import routes from './routes/index.js';
import { razorpayWebhook } from './controllers/payment.controller.js';

const app = express();
app.disable('x-powered-by');
if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY); // needed for correct client IPs / rate limiting behind nginx

app.use(helmet());
const allowedOrigins = env.CLIENT_URL.split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => (!origin || allowedOrigins.includes(origin) ? cb(null, true) : cb(new ApiError(403, 'Origin not allowed.'))),
  credentials: true,
  exposedHeaders: ['Content-Disposition', 'X-Original-Bytes', 'X-Result-Bytes', 'X-Result-Count', 'X-Target-Met', 'Retry-After'],
}));
app.use(compression());
app.use(morgan(isProd ? 'combined' : 'dev'));

app.get('/api/health', (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', uptime: process.uptime() });
});

app.use('/api', globalLimiter);
// Razorpay webhook needs the RAW body (signature is calculated over the exact bytes) -> must come before express.json()
app.post('/api/v1/payments/webhook', express.raw({ type: 'application/json', limit: '256kb' }), razorpayWebhook);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());
app.use(mongoSanitize()); // strips $ and . operators -> NoSQL injection
app.use(hpp()); // HTTP parameter pollution

app.use('/api/v1', routes);
app.use(notFound);
app.use(errorHandler);

export default app;
