import mongoose from 'mongoose';
import { BOOKMARK_KINDS } from '../config/constants.js';

// kind = "save" (saved job) | "follow" (followed exam -> alerts)
const bookmarkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    kind: { type: String, enum: BOOKMARK_KINDS, required: true },
  },
  { timestamps: true }
);

bookmarkSchema.index({ user: 1, job: 1, kind: 1 }, { unique: true });
bookmarkSchema.index({ user: 1, kind: 1, createdAt: -1 });

export const Bookmark = mongoose.model('Bookmark', bookmarkSchema);
