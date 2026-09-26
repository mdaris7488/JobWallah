import mongoose from 'mongoose';

// One active reset code per user (a new request replaces the old one).
// Only a keyed hash of the 6-digit code is stored - never the code itself.
const passwordResetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    lastSentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 }); // expired rows are removed an hour later

export const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);
