/**
 * Normalises a mobile number: "98765 43210", "09876543210", "+91-98765-43210" -> "+919876543210".
 * Other countries are accepted in international format (+<country code><number>).
 * Returns null when the number is not valid.
 */
export function normalizePhone(input) {
  const v = String(input ?? '').replace(/[\s\-().]/g, '');
  const india = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(v);
  if (india) return `+91${india[1]}`;
  if (v.startsWith('+91')) return null; // +91 must be followed by a valid 10-digit Indian mobile number
  if (/^\+[1-9]\d{7,14}$/.test(v)) return v;
  return null;
}
