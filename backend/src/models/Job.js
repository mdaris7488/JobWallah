import mongoose from 'mongoose';
import { SECTORS, CATEGORIES, STATES, JOB_TYPES, WORK_MODES, DAY_MS } from '../config/constants.js';

const linkSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    url: { type: String, required: true, trim: true, maxlength: 500 },
    buttonText: { type: String, trim: true, maxlength: 30, default: 'Open' },
  },
  { _id: false }
);

const text = (max) => ({ type: String, trim: true, maxlength: max });

/**
 * Only title, organization, sector, category and applyUrl are mandatory.
 * Every other field is optional: the admin fills what the company/department provided and the UI simply
 * hides blank sections.
 */
const jobSchema = new mongoose.Schema(
  {
    title: { ...text(200), required: true },
    slug: { type: String, required: true, unique: true },
    organization: { ...text(150), required: true },
    sector: { type: String, enum: SECTORS, required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    applyUrl: { ...text(500), required: true }, // company / department official application page

    vacancies: { type: Number, min: 0, default: 0 },
    qualification: text(120),
    location: text(120),
    state: { type: String, enum: STATES, default: 'All India' },
    jobType: { type: String, enum: JOB_TYPES, default: 'Full Time' },
    workMode: { type: String, enum: WORK_MODES },
    experience: text(40), // e.g. "0-2 Yrs"
    salary: text(80), // display text, e.g. "₹25,500-81,100" or "₹3.5-5 LPA"
    ageLimit: text(60),
    applicationFee: text(80),
    lastDate: Date, // optional - many private jobs have no deadline
    examDate: Date,
    examDateText: text(60), // e.g. "14-24 Dec 2026"

    // ---- optional content sections (plain text; rendered only when filled) ----
    description: text(5000),
    responsibilities: text(5000),
    requirements: text(5000),
    benefits: text(5000),
    vacancyDetails: text(5000),
    eligibility: text(5000),
    ageLimitDetails: text(5000),
    salaryDetails: text(5000),
    selectionProcess: text(5000),
    howToApply: text(5000),
    importantLinks: { type: [linkSchema], default: [] },

    verified: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: true },
    postedAt: { type: Date, default: Date.now },
    viewCount: { type: Number, default: 0 },
    applyClickCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false, transform: (doc, ret) => { delete ret.id; return ret; } },
  }
);

// Derived status shown as the badge in the UI (never stored, so it can't go stale).
jobSchema.virtual('status').get(function status() {
  const now = Date.now();
  if (this.lastDate) {
    const end = this.lastDate.getTime() + DAY_MS;
    if (end < now) return 'EXPIRED';
    if (end - now <= 7 * DAY_MS) return 'CLOSING_SOON';
  }
  if (this.postedAt && now - this.postedAt.getTime() <= 3 * DAY_MS) return 'NEW';
  return 'ACTIVE';
});

jobSchema.index({ isPublished: 1, sector: 1, category: 1, state: 1, postedAt: -1 });
jobSchema.index({ isPublished: 1, lastDate: 1 });
jobSchema.index({ category: 1 });
jobSchema.index({ title: 1 });
jobSchema.index({ organization: 1 });

export const Job = mongoose.model('Job', jobSchema);
