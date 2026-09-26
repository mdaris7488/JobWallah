import http from './http';

const clean = (o = {}) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined && v !== null));

export const authApi = {
  register: (b) => http.post('/auth/register', b),
  login: (b) => http.post('/auth/login', b),
  logout: () => http.post('/auth/logout'),
  forgotPassword: (b) => http.post('/auth/forgot-password', b),
  resetPassword: (b) => http.post('/auth/reset-password', b),
};

export const jobsApi = {
  list: (p) => http.get('/jobs', { params: clean(p) }),
  get: (slug) => http.get(`/jobs/${slug}`),
  stats: () => http.get('/jobs/stats'),
  applyClick: (id) => http.post(`/jobs/${id}/apply-click`),
};

export const updatesApi = { list: (p) => http.get('/updates', { params: clean(p) }) };

export const meApi = {
  dashboard: () => http.get('/me/dashboard'),
  updateProfile: (b) => http.patch('/me', b),
  changePassword: (b) => http.patch('/me/password', b),
  bookmarks: (kind) => http.get('/me/bookmarks', { params: { kind } }),
  addBookmark: (jobId, kind) => http.post('/me/bookmarks', { jobId, kind }),
  removeBookmark: (jobId, kind) => http.delete(`/me/bookmarks/${kind}/${jobId}`),
  applications: () => http.get('/me/applications'),
  updates: () => http.get('/me/updates'),
};

export const subsApi = {
  plans: () => http.get('/subscriptions/plans'),
  mine: () => http.get('/subscriptions/me'),
};

export const paymentsApi = {
  createOrder: (b) => http.post('/payments/orders', b),
  verify: (b) => http.post('/payments/verify', b),
  demoConfirm: (b) => http.post('/payments/demo/confirm', b),
  mine: () => http.get('/payments/me'),
};

/** Receipts are protected, so fetch the PDF with the auth header and save it from the browser. */
export async function downloadReceipt(paymentId, fallbackName = 'receipt') {
  const res = await http.get(`/payments/${paymentId}/invoice`, { responseType: 'blob' });
  const name = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '')?.[1] || `${fallbackName}.pdf`;
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const adminApi = {
  payments: (p) => http.get('/admin/payments', { params: clean(p) }),
  stats: () => http.get('/admin/stats'),
  jobs: (p) => http.get('/admin/jobs', { params: clean(p) }),
  job: (id) => http.get(`/admin/jobs/${id}`),
  createJob: (b) => http.post('/admin/jobs', b),
  updateJob: (id, b) => http.put(`/admin/jobs/${id}`, b),
  deleteJob: (id) => http.delete(`/admin/jobs/${id}`),
  applicants: (p) => http.get('/admin/applications', { params: clean(p) }),
  updates: (p) => http.get('/admin/updates', { params: clean(p) }),
  createUpdate: (b) => http.post('/admin/updates', b),
  deleteUpdate: (id) => http.delete(`/admin/updates/${id}`),
  users: (p) => http.get('/admin/users', { params: clean(p) }),
  setUserActive: (id, isActive) => http.patch(`/admin/users/${id}/status`, { isActive }),
};

/** CSV export needs the auth header, so fetch as a blob and trigger the download from the browser. */
export async function downloadApplicantsCsv(params) {
  const res = await http.get('/admin/applications/export', { params: clean(params), responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `applicants-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
