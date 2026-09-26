import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import {
  idParam, createJobBody, updateJobBody, adminListJobsQuery, adminListApplicantsQuery,
  listUpdatesQuery, updateBody, adminListUsersQuery, setUserStatusBody, adminListPaymentsQuery,
} from '../validators/schemas.js';
import * as jobs from '../controllers/job.controller.js';
import * as apply from '../controllers/apply.controller.js';
import * as updates from '../controllers/update.controller.js';
import * as admin from '../controllers/admin.controller.js';
import { adminListPayments } from '../controllers/payment.controller.js';

const router = Router();
router.use(protect, restrictTo(ROLES.ADMIN)); // every admin route requires an authenticated admin

router.get('/stats', admin.stats);

router.get('/jobs', validate({ query: adminListJobsQuery }), jobs.adminListJobs);
router.post('/jobs', validate({ body: createJobBody }), jobs.createJob);
router.get('/jobs/:id', validate({ params: idParam }), jobs.adminGetJob);
router.put('/jobs/:id', validate({ params: idParam, body: updateJobBody }), jobs.updateJob);
router.delete('/jobs/:id', validate({ params: idParam }), jobs.deleteJob);

// people who clicked "Apply" (with their profile details)
router.get('/applications', validate({ query: adminListApplicantsQuery }), apply.adminListApplicants);
router.get('/applications/export', validate({ query: adminListApplicantsQuery }), apply.adminExportApplicants);

router.get('/updates', validate({ query: listUpdatesQuery }), updates.adminListUpdates);
router.post('/updates', validate({ body: updateBody }), updates.createUpdate);
router.put('/updates/:id', validate({ params: idParam, body: updateBody }), updates.editUpdate);
router.delete('/updates/:id', validate({ params: idParam }), updates.deleteUpdate);

router.get('/payments', validate({ query: adminListPaymentsQuery }), adminListPayments);
router.get('/users', validate({ query: adminListUsersQuery }), admin.listUsers);
router.patch('/users/:id/status', validate({ params: idParam, body: setUserStatusBody }), admin.setUserStatus);
export default router;
