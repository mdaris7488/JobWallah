export const ROLES = Object.freeze({ USER: 'user', ADMIN: 'admin' });
export const SECTORS = ['government', 'private'];
export const CATEGORIES = [
  'Sarkari Naukri', 'Bank & Insurance', 'Railway Jobs', 'Defence & Police', 'Teaching & Edu', 'Healthcare',
  'IT & Software', 'Customer Support', 'Sales & Marketing', 'Operations & Logistics', 'HR & Admin',
  'Finance & Accounts', 'Other',
];
export const STATES = [
  'All India', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
export const JOB_TYPES = ['Full Time', 'Part Time', 'Contract', 'Internship'];
export const WORK_MODES = ['WFO', 'Hybrid', 'Remote', 'Field'];
export const UPDATE_TYPES = ['admit_card', 'result'];
export const BOOKMARK_KINDS = ['save', 'follow'];
export const FREE_FOLLOW_LIMIT = 3;
export const DAY_MS = 86_400_000;

export const PLANS = {
  single_exam: {
    name: 'Single Exam Pass', price: 29, days: 90, period: 'one-time',
    features: ['Track one exam end-to-end', 'Admit card alert', 'Result alert', 'WhatsApp notification'],
  },
  monthly_pro: {
    name: 'Monthly Pro', price: 99, days: 30, period: 'month', popular: true,
    features: ['Unlimited exam tracking', 'Admit Card alerts', 'Exam date alerts', 'Result alerts',
      'Priority WhatsApp alerts', 'Automated voice call alerts', 'Roll-number result tracking', 'Ad-free experience',
      'Pro tools: batch image jobs, PDF merge & page extract, 10x higher daily limits'],
  },
  annual_pass: {
    name: 'Annual Aspirant Pass', price: 499, days: 365, period: 'year',
    features: ['Everything in Pro', 'Central + State tracking', 'Photo/signature tools', 'Mock test date alerts',
      'Long-term aspirant support'],
  },
};

// ------------------------------------------------------------------ Free / Pro tools
export const TOOL_TIERS = ['free', 'pro', 'annual']; // rank order: free < pro (monthly) < annual
export const TOOL_LIMITS = {
  free: {
    dailyOps: 15, dailyVideo: 2, perMinute: 5, concurrent: 1,
    maxImageMb: 10, maxTotalMb: 20, maxFiles: 1, maxPdfImages: 10, maxPdfMb: 20, maxPdfPages: 100,
    maxVideoMb: 50, maxVideoMinutes: 10, videoTimeoutMin: 4,
  },
  pro: {
    dailyOps: 200, dailyVideo: 30, perMinute: 20, concurrent: 2,
    maxImageMb: 30, maxTotalMb: 150, maxFiles: 20, maxPdfImages: 50, maxPdfMb: 50, maxPdfPages: 500,
    maxVideoMb: 300, maxVideoMinutes: 60, videoTimeoutMin: 15,
  },
};
TOOL_LIMITS.annual = { ...TOOL_LIMITS.pro, dailyOps: 500, dailyVideo: 60 };

export const TOOL_CATALOG = [
  { id: 'image-compressor', name: 'Image Compressor', tier: 'free', icon: '🗜', runsIn: 'server',
    description: 'Shrink a photo to the exact size you need, e.g. under 100 KB for an exam form.' },
  { id: 'image-resizer', name: 'Image Resizer', tier: 'free', icon: '📐', runsIn: 'server',
    description: 'Resize by width x height or by percentage. Keeps the aspect ratio if you want.' },
  { id: 'image-converter', name: 'Image Converter', tier: 'free', icon: '🔄', runsIn: 'server',
    description: 'Convert between JPG, PNG, WebP and AVIF.' },
  { id: 'image-to-pdf', name: 'Image to PDF', tier: 'free', icon: '🖼', runsIn: 'server',
    description: 'Combine one or more images into a single PDF.' },
  { id: 'pdf-to-image', name: 'PDF to Image', tier: 'free', icon: '📄', runsIn: 'browser',
    description: 'Turn every PDF page into a PNG or JPG. Runs in your browser - the PDF is never uploaded.' },
  { id: 'video-compressor', name: 'Video Compressor', tier: 'free', icon: '🎬', runsIn: 'server',
    description: 'Reduce a video to the size you need (e.g. 20 MB). Free plan has smaller limits.' },
  { id: 'pdf-merge', name: 'PDF Merge', tier: 'pro', icon: '📚', runsIn: 'server',
    description: 'Join several PDFs into one, in the order you choose.' },
  { id: 'pdf-extract', name: 'PDF Page Extractor', tier: 'pro', icon: '✂', runsIn: 'server',
    description: 'Keep only the pages you need, e.g. 1-3, 5, 8-10.' },
  { id: 'exam-photo', name: 'Exam Photo & Signature', tier: 'annual', icon: '🪪', runsIn: 'server',
    description: 'Exact pixel size + max KB for exam application photos and signatures, with ready presets.' },
];
