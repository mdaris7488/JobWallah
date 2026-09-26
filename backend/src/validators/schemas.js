import { z } from 'zod';
import { normalizePhone } from '../utils/phone.js';
import {
  CATEGORIES, STATES, JOB_TYPES, WORK_MODES, SECTORS, UPDATE_TYPES, BOOKMARK_KINDS, PLANS,
} from '../config/constants.js';

// ---------- primitives ----------
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
// z.string().url() accepts "javascript:..." - so we explicitly allow only http(s) (prevents XSS via href).
const httpUrl = z.string().trim().max(500).url('Enter a valid URL')
  .refine((u) => /^https?:\/\//i.test(u), 'Only http:// or https:// links are allowed');
const optText = (max) => z.string().trim().max(max).optional();
const password = z.string().min(8, 'Password must be at least 8 characters').max(72)
  .regex(/[A-Za-z]/, 'Password must contain a letter').regex(/\d/, 'Password must contain a number');
const phone = z.string().trim().min(1, 'Mobile number is required')
  .refine((v) => normalizePhone(v) !== null, 'Enter a valid mobile number, e.g. 9876543210')
  .transform((v) => normalizePhone(v));

export const idParam = z.object({ id: objectId });

// ---------- auth ----------
export const registerBody = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password,
  phone, // mandatory
});
export const loginBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(72),
});

// ---------- profile ----------
export const updateProfileBody = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: phone.optional(),
  qualification: z.string().trim().max(60).optional(),
  state: z.union([z.enum(STATES), z.literal('')]).optional(),
  alertPreferences: z.object({
    whatsapp: z.boolean(),
    categories: z.array(z.enum(CATEGORIES)).max(CATEGORIES.length),
  }).optional(),
});
export const forgotPasswordBody = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
export const resetPasswordBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  newPassword: password,
});
export const changePasswordBody = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: password,
});

// ---------- jobs ----------
const linkSchema = z.object({
  label: z.string().trim().min(1).max(80),
  url: httpUrl,
  buttonText: z.string().trim().max(30).optional(),
});

// Mandatory: title, organization, sector, category, applyUrl. Everything else is optional (blank = hidden in UI).
const jobBase = z.object({
  title: z.string().trim().min(3).max(200),
  organization: z.string().trim().min(2).max(150),
  sector: z.enum(SECTORS),
  category: z.enum(CATEGORIES),
  applyUrl: httpUrl,

  vacancies: z.coerce.number().int().min(0).max(10_000_000).default(0),
  qualification: optText(120),
  location: optText(120),
  state: z.enum(STATES).default('All India'),
  jobType: z.enum(JOB_TYPES).default('Full Time'),
  workMode: z.enum(WORK_MODES).optional(),
  experience: optText(40),
  salary: optText(80),
  ageLimit: optText(60),
  applicationFee: optText(80),
  lastDate: z.coerce.date().optional().nullable(),
  examDate: z.coerce.date().optional().nullable(),
  examDateText: optText(60),

  description: optText(5000),
  responsibilities: optText(5000),
  requirements: optText(5000),
  benefits: optText(5000),
  vacancyDetails: optText(5000),
  eligibility: optText(5000),
  ageLimitDetails: optText(5000),
  salaryDetails: optText(5000),
  selectionProcess: optText(5000),
  howToApply: optText(5000),
  importantLinks: z.array(linkSchema).max(10).default([]),

  verified: z.boolean().default(false),
  isPublished: z.boolean().default(true),
});

export const createJobBody = jobBase;
export const updateJobBody = jobBase.partial();

const listBase = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().trim().max(100).optional(),
  sector: z.enum(SECTORS).optional(),
  category: z.enum(CATEGORIES).optional(),
  state: z.enum(STATES).optional(),
  jobType: z.enum(JOB_TYPES).optional(),
  workMode: z.enum(WORK_MODES).optional(),
  qualification: z.string().trim().max(60).optional(),
  status: z.enum(['active', 'expired']).optional(),
  sort: z.enum(['latest', 'lastDate']).default('latest'),
};
export const listJobsQuery = z.object(listBase);
export const adminListJobsQuery = z.object({ ...listBase, published: z.enum(['true', 'false']).optional() });
export const slugParam = z.object({ slug: z.string().trim().min(1).max(200) });

// ---------- applicants (users who clicked Apply) ----------
export const adminListApplicantsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(15),
  job: objectId.optional(),
  category: z.enum(CATEGORIES).optional(),
  sector: z.enum(SECTORS).optional(),
  q: z.string().trim().max(100).optional(),
});

// ---------- bookmarks ----------
export const addBookmarkBody = z.object({ jobId: objectId, kind: z.enum(BOOKMARK_KINDS) });
export const bookmarkQuery = z.object({ kind: z.enum(BOOKMARK_KINDS) });
export const removeBookmarkParams = z.object({ kind: z.enum(BOOKMARK_KINDS), jobId: objectId });

// ---------- updates (admit card / result) ----------
export const listUpdatesQuery = z.object({
  type: z.enum(UPDATE_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const updateBody = z.object({
  title: z.string().trim().min(3).max(200),
  type: z.enum(UPDATE_TYPES),
  link: httpUrl,
  job: objectId.optional().nullable(),
  isPublished: z.boolean().default(true),
});

// ---------- payments ----------
export const createOrderBody = z.object({ plan: z.enum(Object.keys(PLANS)), jobId: objectId.optional() });
export const verifyPaymentBody = z.object({
  paymentId: objectId,
  razorpay_order_id: z.string().trim().min(5).max(64),
  razorpay_payment_id: z.string().trim().min(5).max(64),
  razorpay_signature: z.string().trim().regex(/^[a-f0-9]{64}$/i, 'Invalid signature'),
});
export const demoConfirmBody = z.object({ paymentId: objectId });
export const adminListPaymentsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(15),
  status: z.enum(['created', 'paid', 'failed', 'refunded']).optional(),
  q: z.string().trim().max(100).optional(),
});

// ---------- admin users ----------
export const adminListUsersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(15),
  q: z.string().trim().max(100).optional(),
});
export const setUserStatusBody = z.object({ isActive: z.boolean() });
