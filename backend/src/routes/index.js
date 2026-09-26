import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listUpdatesQuery } from '../validators/schemas.js';
import { listUpdates } from '../controllers/update.controller.js';
import { listPlans, mySubscriptions } from '../controllers/subscription.controller.js';
import authRoutes from './auth.routes.js';
import jobRoutes from './job.routes.js';
import meRoutes from './me.routes.js';
import adminRoutes from './admin.routes.js';
import toolsRoutes from './tools.routes.js';
import paymentRoutes from './payment.routes.js';

const router = Router();
router.use('/auth', authRoutes);
router.use('/jobs', jobRoutes);
router.use('/me', meRoutes);
router.use('/admin', adminRoutes);
router.use('/tools', toolsRoutes);
router.use('/payments', paymentRoutes);

router.get('/updates', validate({ query: listUpdatesQuery }), listUpdates);
router.get('/subscriptions/plans', listPlans);
router.get('/subscriptions/me', protect, mySubscriptions);

export default router;
