import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import {
  updateProfileBody, changePasswordBody, addBookmarkBody, bookmarkQuery, removeBookmarkParams,
} from '../validators/schemas.js';
import * as me from '../controllers/me.controller.js';
import * as apply from '../controllers/apply.controller.js';

const router = Router();
router.use(protect);
router.patch('/', validate({ body: updateProfileBody }), me.updateProfile);
router.patch('/password', validate({ body: changePasswordBody }), me.changePassword);
router.get('/dashboard', me.dashboard);
router.get('/bookmarks', validate({ query: bookmarkQuery }), me.listBookmarks);
router.post('/bookmarks', validate({ body: addBookmarkBody }), me.addBookmark);
router.delete('/bookmarks/:kind/:jobId', validate({ params: removeBookmarkParams }), me.removeBookmark);
router.get('/applications', apply.myApplications);
router.get('/updates', me.myUpdates);
export default router;
