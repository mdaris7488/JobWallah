const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const formatDate = (d) => (d ? dateFmt.format(new Date(d)) : '-');
export const formatNumber = (n) => Number(n || 0).toLocaleString('en-IN');

export function timeAgo(date) {
  const mins = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'RS';

/** Only ever render http(s) links coming from the DB (defence in depth against javascript: URLs). */
export const safeUrl = (url) => (/^https?:\/\//i.test(url || '') ? url : '#');

export const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export const formatBytes = (n) => {
  if (!Number.isFinite(n)) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1048576).toFixed(n < 10485760 ? 2 : 1)} MB`;
};
