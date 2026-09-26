import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Standard PDF fonts only cover Latin-1, so anything else (e.g. Hindi names) is replaced by "?" and "₹" is written as "Rs.".
const safe = (v) => String(v ?? '-').normalize('NFKD').replace(/[^\x20-\x7E]/g, '?').slice(0, 90);
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

/** Simple one-page payment receipt (PDF). Prices are tax-inclusive. */
export async function buildReceiptPdf({ receiptNo, paidAt, status, billing, planName, validity, amount, paymentId, method, provider }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`JobWallah receipt ${receiptNo}`);
  pdf.setProducer('JobWallah');
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.055, 0.133, 0.251);
  const saffron = rgb(0.91, 0.443, 0.04);
  const grey = rgb(0.36, 0.41, 0.5);
  const line = rgb(0.85, 0.88, 0.93);
  const white = rgb(1, 1, 1);
  const L = 44; const R = 595.28 - 44;

  page.drawRectangle({ x: 0, y: 762, width: 595.28, height: 80, color: navy });
  page.drawText('RS', { x: L, y: 795, size: 24, font: bold, color: rgb(0.96, 0.65, 0.26) });
  page.drawText('JobWallah', { x: L + 38, y: 795, size: 22, font: bold, color: white });
  page.drawText('PAYMENT RECEIPT', { x: R - bold.widthOfTextAtSize('PAYMENT RECEIPT', 13), y: 799, size: 13, font: bold, color: white });

  let y = 720;
  const kv = (label, value, x = L) => {
    page.drawText(label, { x, y, size: 9, font, color: grey });
    page.drawText(safe(value), { x, y: y - 15, size: 12, font: bold, color: navy });
  };
  kv('Receipt no.', receiptNo); kv('Date', paidAt ? fmtDate(paidAt) : '-', 240); kv('Status', String(status).toUpperCase(), 420);
  y -= 58;
  page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 1, color: line });
  y -= 28;
  page.drawText('BILLED TO', { x: L, y, size: 9, font: bold, color: saffron });
  y -= 18;
  for (const t of [billing?.name, billing?.email, billing?.phone].filter(Boolean)) { page.drawText(safe(t), { x: L, y, size: 12, font, color: navy }); y -= 16; }

  y -= 20;
  page.drawRectangle({ x: L, y: y - 6, width: R - L, height: 26, color: rgb(0.95, 0.96, 0.98) });
  page.drawText('Description', { x: L + 10, y: y + 2, size: 10, font: bold, color: navy });
  page.drawText('Amount', { x: R - 60, y: y + 2, size: 10, font: bold, color: navy });
  y -= 34;
  page.drawText(safe(planName), { x: L + 10, y, size: 12, font: bold, color: navy });
  page.drawText(safe(validity), { x: L + 10, y: y - 15, size: 10, font, color: grey });
  const price = `Rs. ${Number(amount).toFixed(2)}`;
  page.drawText(price, { x: R - 10 - font.widthOfTextAtSize(price, 12), y, size: 12, font, color: navy });
  y -= 38;
  page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 1, color: line });
  y -= 26;
  page.drawText('Total paid (inclusive of all taxes)', { x: L + 10, y, size: 11, font: bold, color: navy });
  page.drawText(price, { x: R - 10 - bold.widthOfTextAtSize(price, 15), y: y - 1, size: 15, font: bold, color: saffron });

  y -= 62;
  page.drawText('PAYMENT DETAILS', { x: L, y, size: 9, font: bold, color: saffron });
  y -= 20;
  kv('Payment id', paymentId || '-'); kv('Method', method ? String(method).toUpperCase() : '-', 300);
  y -= 46;
  kv('Payment gateway', provider === 'razorpay' ? 'Razorpay' : 'Demo (no real payment)');

  page.drawLine({ start: { x: L, y: 90 }, end: { x: R, y: 90 }, thickness: 1, color: line });
  page.drawText('This is a computer-generated receipt and does not need a signature.', { x: L, y: 70, size: 9, font, color: grey });
  page.drawText('JobWallah is an independent employment information platform and is not a government website.', { x: L, y: 56, size: 9, font, color: grey });
  return Buffer.from(await pdf.save());
}
