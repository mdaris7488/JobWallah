import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { paymentLimiter } from '../middleware/rateLimiters.js';
import { idParam, createOrderBody, verifyPaymentBody, demoConfirmBody } from '../validators/schemas.js';
import * as pay from '../controllers/payment.controller.js';

const router = Router();
router.use(protect);
router.get('/me', pay.myPayments);
router.post('/orders', paymentLimiter, validate({ body: createOrderBody }), pay.createOrderCtl);
router.post('/verify', paymentLimiter, validate({ body: verifyPaymentBody }), pay.verifyPayment);
router.post('/demo/confirm', paymentLimiter, validate({ body: demoConfirmBody }), pay.demoConfirm);
router.get('/:id/invoice', validate({ params: idParam }), pay.receipt);
export default router;
