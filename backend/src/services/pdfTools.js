import fsp from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { ApiError } from '../utils/ApiError.js';
import { toPdfJpeg } from './imageTools.js';

const A4 = [595.28, 841.89];
const MARGINS = { none: 0, small: 18, medium: 36 }; // points

async function loadPdf(filePath) {
  const bytes = await fsp.readFile(filePath);
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw new ApiError(400, 'This file is not a valid PDF.');
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (err) {
    if (/encrypt/i.test(String(err.message))) throw new ApiError(422, 'This PDF is password protected. Remove the password first.');
    throw new ApiError(400, 'This PDF is damaged or not supported.');
  }
}

const finish = async (pdf) => {
  pdf.setProducer('JobWallah Tools');
  pdf.setCreator('JobWallah');
  return Buffer.from(await pdf.save());
};

export async function imagesToPdf(paths, { pageSize = 'a4', margin = 'small', orientation = 'auto' } = {}) {
  const pdf = await PDFDocument.create();
  const m = MARGINS[margin] ?? MARGINS.small;

  for (const filePath of paths) {
    const { data, width: iw, height: ih } = await toPdfJpeg(filePath);
    const image = await pdf.embedJpg(data);

    let pw; let ph; let scale;
    if (pageSize === 'fit') {
      scale = 0.75; // 96 dpi pixels -> points
      pw = iw * scale + 2 * m; ph = ih * scale + 2 * m;
    } else {
      const landscape = orientation === 'landscape' || (orientation === 'auto' && iw > ih);
      [pw, ph] = landscape ? [A4[1], A4[0]] : A4;
      scale = Math.min((pw - 2 * m) / iw, (ph - 2 * m) / ih, 1);
    }
    const dw = iw * scale; const dh = ih * scale;
    const page = pdf.addPage([pw, ph]);
    page.drawImage(image, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
  }
  return finish(pdf);
}

export async function mergePdfs(paths, { maxPages }) {
  const out = await PDFDocument.create();
  let total = 0;
  for (const filePath of paths) {
    const src = await loadPdf(filePath);
    total += src.getPageCount();
    if (total > maxPages) throw new ApiError(413, `Too many pages in total (max ${maxPages}).`);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return { buffer: await finish(out), pages: total };
}

/** "1-3, 5, 8-10" -> [0,1,2,4,7,8,9] (0-based, in the order given, duplicates removed) */
export function parsePageRanges(text, pageCount) {
  const result = [];
  const seen = new Set();
  for (const part of String(text).split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!m) throw new ApiError(400, `"${part}" is not a valid page range. Example: 1-3, 5, 8-10`);
    const a = Number(m[1]); const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < a) throw new ApiError(400, `"${part}" is not a valid page range.`);
    if (b > pageCount) throw new ApiError(400, `Page ${b} does not exist. This PDF has ${pageCount} page(s).`);
    for (let p = a; p <= b; p += 1) if (!seen.has(p)) { seen.add(p); result.push(p - 1); }
  }
  if (!result.length) throw new ApiError(400, 'Enter at least one page number.');
  return result;
}

export async function extractPages(filePath, rangesText, { maxPages }) {
  const src = await loadPdf(filePath);
  if (src.getPageCount() > maxPages) throw new ApiError(413, `This PDF has too many pages (max ${maxPages}).`);
  const indices = parsePageRanges(rangesText, src.getPageCount());
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return { buffer: await finish(out), pages: indices.length, totalPages: src.getPageCount() };
}
