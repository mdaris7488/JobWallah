import mongoose from 'mongoose';

// Opaque refresh tokens: only the SHA-256 hash is stored. Rotated on every use; a re-used (already revoked)
// token revokes the whole "family" -> stolen-token detection.
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    userAgent: String,
    ip: String,
  },
  { timestamps: true }
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // auto-clean expired docs

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
