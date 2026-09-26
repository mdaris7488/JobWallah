import { DAY_MS } from '../config/constants.js';

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A job stays open until the END of its last date. Anything before this cutoff is expired. */
export const expiryCutoff = () => new Date(Date.now() - DAY_MS);

/** Mongo condition for "still open": no deadline set (private jobs) OR deadline not yet passed. */
export const openCondition = () => ({ $or: [{ lastDate: null }, { lastDate: { $gte: expiryCutoff() } }] });

/** CSV cell escaping incl. protection against spreadsheet formula injection (=, +, -, @). */
export const csvCell = (value) => {
  let s = value === undefined || value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
