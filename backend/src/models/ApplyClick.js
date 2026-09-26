import mongoose from 'mongoose';

// One row per (user, job): created the first time a logged-in user clicks "Apply" (which sends them to the
// company's official page). clickCount / lastClickedAt keep counting repeat clicks.
const applyClickSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    clickCount: { type: Number, min: 0 },
    lastClickedAt: { type: Date },
  },
  { timestamps: true }
);

applyClickSchema.index({ user: 1, job: 1 }, { unique: true });
applyClickSchema.index({ job: 1, lastClickedAt: -1 });
applyClickSchema.index({ lastClickedAt: -1 });

export const ApplyClick = mongoose.model('ApplyClick', applyClickSchema);
