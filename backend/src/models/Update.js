import mongoose from 'mongoose';
import { UPDATE_TYPES } from '../config/constants.js';

// Admit card / result announcements shown on the home page and used for follower alerts.
const updateSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    type: { type: String, enum: UPDATE_TYPES, required: true },
    link: { type: String, required: true, trim: true, maxlength: 500 },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    isPublished: { type: Boolean, default: true },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

updateSchema.index({ type: 1, isPublished: 1, publishedAt: -1 });

export const Update = mongoose.model('Update', updateSchema);
