import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { protect, optionalAuth } from '../middleware/auth.js';
import {
  cleanupUploads, jobPollLimiter, loadPlan, requireTier, requireUpload, reserve, toolIpLimiter, toolUserLimiter, userConcurrency,
} from '../middleware/toolsGuard.js';
import {
  uploadImages, uploadImagesForPdf, uploadPdfs, uploadVideo,
} from '../middleware/toolsUpload.js';
import { jobIdParam } from '../validators/toolSchemas.js';
import * as tools from '../controllers/tools.controller.js';

const router = Router();

// public: catalog + limits (+ today's usage when logged in)
router.get('/config', optionalAuth, tools.toolsConfig);

// everything below needs a logged-in user and passes through the abuse-protection layers
router.use(toolIpLimiter, protect, loadPlan);

/**
 * Layers, in order:  per-user rate limit -> plan check -> size pre-check -> concurrency -> daily quota -> temp cleanup -> upload
 * (cheap checks first, so a rejected request never costs disk or CPU)
 */
// (video keeps its upload until the background job has finished with it, so it is NOT auto-cleaned here)
const guarded = (tier, kind, upload, quotaKind = 'op') => [
  toolUserLimiter, requireTier(tier), requireUpload(kind), userConcurrency, reserve(quotaKind),
  ...(kind === 'video' ? [] : [cleanupUploads]), upload,
];

router.post('/image/compress', ...guarded('free', 'image', uploadImages), tools.compressImages);
router.post('/image/resize', ...guarded('free', 'image', uploadImages), tools.resizeImages);
router.post('/image/convert', ...guarded('free', 'image', uploadImages), tools.convertImages);
router.post('/image/exam-photo', ...guarded('annual', 'image', uploadImages), tools.examPhoto);
router.post('/pdf/from-images', ...guarded('free', 'image', uploadImagesForPdf), tools.imagesToPdfCtl);
router.post('/pdf/merge', ...guarded('pro', 'pdf', uploadPdfs), tools.mergePdfCtl);
router.post('/pdf/extract', ...guarded('pro', 'pdf', uploadPdfs), tools.extractPdfCtl);

// video: upload -> background job (poll status, then download)
router.post('/video/compress', ...guarded('free', 'video', uploadVideo, 'video'), tools.startVideo);
router.get('/jobs/:id', jobPollLimiter, validate({ params: jobIdParam }), tools.videoStatus);
router.get('/jobs/:id/download', jobPollLimiter, validate({ params: jobIdParam }), tools.videoDownload);

export default router;
