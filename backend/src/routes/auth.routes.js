import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { authLimiter, forgotEmailLimiter, forgotIpLimiter, resetLimiter } from '../middleware/rateLimiters.js';
import { registerBody, loginBody, forgotPasswordBody, resetPasswordBody } from '../validators/schemas.js';
import * as auth from '../controllers/auth.controller.js';

const router = Router();
router.post('/register', authLimiter, validate({ body: registerBody }), auth.register);
router.post('/login', authLimiter, validate({ body: loginBody }), auth.login);
router.post('/forgot-password', forgotIpLimiter, validate({ body: forgotPasswordBody }), forgotEmailLimiter, auth.forgotPassword);
router.post('/reset-password', resetLimiter, validate({ body: resetPasswordBody }), auth.resetPassword);
router.post('/refresh', authLimiter, auth.refresh);
router.post('/logout', auth.logout);
router.get('/me', protect, auth.me);
export default router;
