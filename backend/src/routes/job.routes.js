import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { protect, optionalAuth } from '../middleware/auth.js';
import { applyLimiter } from '../middleware/rateLimiters.js';
import { listJobsQuery, slugParam, idParam } from '../validators/schemas.js';
import * as jobs from '../controllers/job.controller.js';
import * as apply from '../controllers/apply.controller.js';

const router = Router();
router.get('/', validate({ query: listJobsQuery }), jobs.listJobs);
router.get('/stats', jobs.jobStats); // must stay above "/:slug"
router.get('/:slug', optionalAuth, validate({ params: slugParam }), jobs.getJobBySlug);
router.post('/:id/apply-click', protect, applyLimiter, validate({ params: idParam }), apply.recordApplyClick);
export default router;
