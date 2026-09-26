/**
 * Seeds the database with an admin user, a demo user (non-production only) and sample jobs from the design.
 *   npm run seed          -> creates admin + sample data only if the DB is empty
 *   npm run seed:reset    -> wipes jobs/updates/apply-clicks/bookmarks first, then re-seeds
 *
 * NOTE: apply links of the private sample jobs are placeholders (example.com). Replace them from the admin panel.
 */
import { env, isProd } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { Update } from '../models/Update.js';
import { ApplyClick } from '../models/ApplyClick.js';
import { Bookmark } from '../models/Bookmark.js';
import { Subscription } from '../models/Subscription.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { PasswordReset } from '../models/PasswordReset.js';
import { ToolUsage } from '../models/ToolUsage.js';
import { Payment } from '../models/Payment.js';
import { Counter } from '../models/Counter.js';

const DAY = 86_400_000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);
const d = (iso) => new Date(`${iso}T00:00:00.000Z`);

const links = (site) => [
  { label: 'Official Notification', url: `${site}/notification`, buttonText: 'View PDF' },
  { label: 'Apply Online', url: `${site}/apply`, buttonText: 'Apply Now' },
  { label: 'Official Website', url: site, buttonText: 'Visit Website' },
  { label: 'Admit Card', url: `${site}/admit-card`, buttonText: 'Download' },
  { label: 'Result', url: `${site}/result`, buttonText: 'Check Result' },
];

const govJobs = [
  {
    title: 'SSC CGL 2026', organization: 'Staff Selection Commission', category: 'Sarkari Naukri', vacancies: 14582,
    qualification: 'Graduate', state: 'All India', location: 'All India', lastDate: d('2026-10-15'), postedAt: daysAgo(30),
    examDate: d('2026-12-14'), examDateText: '14-24 Dec 2026', ageLimit: '18-32 Years', salary: '₹25,500-81,100',
    applicationFee: '₹100 / Nil', verified: true, applyUrl: 'https://ssc.gov.in',
    description: 'The SSC has released vacancies for Group B and C posts across central government departments.',
    vacancyDetails: 'Assistant Section Officer - 2,145\nIncome Tax Inspector - 1,830\nSub Inspector - 620',
    eligibility: "Bachelor's Degree from a recognised university in any discipline.",
    ageLimitDetails: '18 to 32 years as on 01 Jan 2026, with standard category relaxation.',
    salaryDetails: 'Pay Level 4 to 8 (7th CPC), approx ₹25,500 - ₹81,100 per month.',
    selectionProcess: 'Tier 1 (CBT) -> Tier 2 (CBT) -> Document Verification -> Medical.',
    importantLinks: links('https://ssc.gov.in'),
  },
  {
    title: 'RRB NTPC Recruitment 2026', organization: 'Railway Recruitment Board', category: 'Railway Jobs', vacancies: 8113,
    qualification: '12th/Graduate', state: 'All India', location: 'All India', lastDate: d('2026-11-02'), postedAt: daysAgo(1),
    ageLimit: '18-33 Years', salary: '₹19,900-63,200', applicationFee: '₹500 / ₹250', verified: true,
    applyUrl: 'https://indianrailways.gov.in',
    description: 'Railway Recruitment Boards invite applications for Non-Technical Popular Categories (NTPC).',
    eligibility: '12th pass for undergraduate posts; any Graduate degree for graduate-level posts.',
    selectionProcess: 'CBT 1 -> CBT 2 -> Typing/Aptitude Test (where applicable) -> Document Verification -> Medical.',
    importantLinks: links('https://indianrailways.gov.in'),
  },
  {
    title: 'IBPS PO Recruitment 2026', organization: 'IBPS', category: 'Bank & Insurance', vacancies: 3455,
    qualification: 'Graduate', state: 'All India', location: 'All India', lastDate: d('2026-09-28'), postedAt: daysAgo(12),
    ageLimit: '20-30 Years', salary: '₹52,000-1,05,000', applicationFee: '₹850 / ₹175', verified: true, applyUrl: 'https://ibps.in',
    description: 'Probationary Officer / Management Trainee recruitment for participating public sector banks.',
    selectionProcess: 'Prelims -> Mains -> Interview.', importantLinks: links('https://ibps.in'),
  },
  {
    title: 'UP Police Constable Bharti', organization: 'UP Police Board', category: 'Defence & Police', vacancies: 26210,
    qualification: '12th Pass', state: 'Uttar Pradesh', location: 'Uttar Pradesh', lastDate: d('2026-10-10'), postedAt: daysAgo(8),
    ageLimit: '18-25 Years', salary: '₹21,700-69,100', applicationFee: '₹400', verified: true, applyUrl: 'https://uppbpb.gov.in',
    description: 'Direct recruitment of Civil Police Constables in Uttar Pradesh Police.',
    selectionProcess: 'Written Exam -> Physical Standard/Efficiency Test -> Document Verification.',
    importantLinks: links('https://uppbpb.gov.in'),
  },
  {
    title: 'AIIMS Nursing Officer', organization: 'AIIMS Delhi', category: 'Healthcare', vacancies: 712,
    qualification: 'B.Sc Nursing', state: 'Delhi', location: 'New Delhi', lastDate: d('2026-08-30'), postedAt: daysAgo(40),
    ageLimit: '21-30 Years', salary: '₹44,900-1,42,400', applicationFee: '₹3000 / ₹2400', verified: true,
    applyUrl: 'https://aiimsexams.ac.in', description: 'Recruitment of Nursing Officers (Normal Recruitment Exam).',
    importantLinks: links('https://aiimsexams.ac.in'),
  },
].map((j) => ({ ...j, sector: 'government', jobType: 'Full Time' }));

const priv = (title, organization, category, city, state, experience, workMode, salary, hoursAgo, extra = {}) => ({
  title, organization, category, sector: 'private', location: city, state, experience, workMode, salary,
  qualification: 'Graduate', vacancies: 5, jobType: 'Full Time', verified: false,
  applyUrl: `https://www.example.com/careers/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, // placeholder
  postedAt: new Date(Date.now() - hoursAgo * 3_600_000),
  ...extra,
});

const privateJobs = [
  priv('Customer Support Executive', 'ABC Technologies', 'Customer Support', 'Noida', 'Uttar Pradesh', '0-2 Yrs', 'WFO', '₹3.5-5 LPA', 48, {
    verified: true,
    description: 'ABC Technologies is hiring Customer Support Executives to handle inbound chat and voice queries for its SaaS customers.',
    responsibilities: '- Resolve customer queries over phone, chat and email\n- Log every interaction in the CRM\n- Escalate complex issues to the right team\n- Meet weekly quality and turnaround targets',
    requirements: '- Graduate in any stream\n- Clear communication in English and Hindi\n- Comfortable with rotational shifts',
    benefits: 'Health insurance, performance bonus, cab facility for night shifts.',
  }),
  priv('Junior Software Developer', 'Infonet Systems', 'IT & Software', 'Bengaluru', 'Karnataka', '1-3 Yrs', 'Hybrid', '₹6-9 LPA', 24, {
    verified: true, qualification: 'B.Tech / BCA / MCA',
    description: 'Join the platform team building internal tools and customer-facing APIs.',
    responsibilities: '- Build and maintain REST APIs\n- Write unit tests and review peers\' code\n- Work with product to break features into tasks',
    requirements: '- 1-3 years with Node.js or Java\n- Good grasp of SQL / MongoDB\n- Git and basic Docker knowledge',
  }),
  priv('Sales Relationship Officer', 'Sunrise Financial', 'Sales & Marketing', 'Pune', 'Maharashtra', '0-1 Yrs', 'Field', '₹2.8-4 LPA', 96),
  priv('Warehouse Supervisor', 'Maxlog Supply Chain', 'Operations & Logistics', 'Ahmedabad', 'Gujarat', '2-4 Yrs', 'WFO', '₹3.2-4.5 LPA', 72, {
    verified: true,
    description: 'Supervise daily inbound/outbound operations of a 40,000 sq ft fulfilment centre.',
    responsibilities: '- Plan shifts and manage a team of 25\n- Keep inventory accuracy above 99%\n- Ensure safety compliance',
  }),
  priv('HR Recruiter (Fresher)', 'Horizon Staffing', 'HR & Admin', 'Remote', 'All India', '0 Yrs', 'Remote', '₹2.4-3 LPA', 6),
  priv('Data Entry Operator', 'DataCore Solutions', 'HR & Admin', 'Lucknow', 'Uttar Pradesh', '0-1 Yrs', 'WFO', '₹1.8-2.4 LPA', 120, {
    verified: true, qualification: '12th Pass',
  }),
];

const updates = [
  ['SSC CHSL Tier 1 Admit Card', 'admit_card', 'https://ssc.gov.in', 0],
  ['RRB Group D Admit Card', 'admit_card', 'https://indianrailways.gov.in', 1],
  ['IBPS Clerk Prelims Admit Card', 'admit_card', 'https://ibps.in', 2],
  ['SSC MTS Final Result 2026', 'result', 'https://ssc.gov.in', 0],
  ['UPSC CSE Prelims Result', 'result', 'https://upsc.gov.in', 1],
  ['Bihar Police Constable Result', 'result', 'https://csbc.bihar.gov.in', 2],
].map(([title, type, link, n]) => ({ title, type, link, publishedAt: daysAgo(n) }));

async function run() {
  await connectDB();
  await Promise.all([User, Job, ApplyClick, Bookmark, Update, Subscription, RefreshToken, PasswordReset, ToolUsage, Payment, Counter].map((m) => m.init())); // make sure indexes exist

  if (process.argv.includes('--reset')) {
    await Promise.all([Job.deleteMany({}), Update.deleteMany({}), ApplyClick.deleteMany({}), Bookmark.deleteMany({})]);
    console.log('🧹 Cleared jobs, updates, apply clicks, bookmarks');
  }

  let admin = await User.findOne({ email: env.SEED_ADMIN_EMAIL.toLowerCase() });
  if (!admin) {
    admin = await User.create({ name: env.SEED_ADMIN_NAME, email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD, role: 'admin', phone: '+919999999999' });
    console.log(`👤 Admin created: ${env.SEED_ADMIN_EMAIL}`);
  } else {
    console.log(`👤 Admin already exists: ${env.SEED_ADMIN_EMAIL}`);
  }

  if (!isProd && !(await User.exists({ email: 'user@jobwallah.in' }))) {
    await User.create({ name: 'Demo Aspirant', email: 'user@jobwallah.in', password: 'User@12345', role: 'user', phone: '+919876543210', qualification: 'Graduate', state: 'Uttar Pradesh' });
    console.log('👤 Demo user created: user@jobwallah.in / User@12345');
  }

  if ((await Job.countDocuments()) === 0) {
    const slugOf = (t, i) => `${t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${(1000 + i).toString(16)}`;
    const all = [...govJobs, ...privateJobs].map((j, i) => ({ ...j, slug: slugOf(j.title, i), createdBy: admin._id, updatedBy: admin._id }));
    const created = await Job.insertMany(all);
    console.log(`💼 Inserted ${created.length} jobs`);
    const pick = (s) => created.find((j) => j.title.startsWith(s));
    const linked = [pick('SSC CGL'), pick('RRB NTPC'), pick('IBPS PO'), pick('SSC CGL'), pick('UP Police'), pick('IBPS PO')];
    await Update.insertMany(updates.map((u, i) => ({ ...u, job: linked[i]?._id })));
    console.log(`📢 Inserted ${updates.length} admit card / result updates`);
  } else {
    console.log('ℹ️  Jobs already present - skipping sample data (use npm run seed:reset to start fresh)');
  }

  await disconnectDB();
  console.log('✅ Seeding complete');
}

run().catch(async (err) => { console.error('Seed failed:', err); await disconnectDB(); process.exit(1); });
