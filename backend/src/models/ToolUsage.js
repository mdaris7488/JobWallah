import mongoose from 'mongoose';

// One document per user per (India) day. Used for the daily quota of the free/pro tools.
const toolUsageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true }, // YYYY-MM-DD in IST
    total: { type: Number, min: 0 },
    video: { type: Number, min: 0 },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

toolUsageSchema.index({ user: 1, day: 1 }, { unique: true });
toolUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // old counters clean themselves

export const ToolUsage = mongoose.model('ToolUsage', toolUsageSchema);
