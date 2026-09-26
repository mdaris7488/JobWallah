import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, STATES, CATEGORIES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER },
    phone: { type: String, trim: true, maxlength: 16 }, // E.164, e.g. +919876543210
    qualification: { type: String, trim: true, maxlength: 60 },
    state: { type: String, enum: STATES },
    alertPreferences: {
      whatsapp: { type: Boolean, default: false },
      categories: [{ type: String, enum: CATEGORIES }],
    },
    isActive: { type: Boolean, default: true },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    passwordChangedAt: { type: Date, select: false },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.failedLoginAttempts;
    delete ret.lockUntil;
    delete ret.passwordChangedAt;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
