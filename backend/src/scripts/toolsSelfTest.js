/**
 * Offline self-test of the tool engines (no database / no HTTP needed):
 *   npm run test:tools
 * Generates real images / PDFs / a video, runs every engine and checks the promised behaviour.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { TOOLS_DIR } from '../utils/tmpFiles.js';
import { compressToTarget, resizeImage, convertImage, inspectImage } from '../services/imageTools.js';
import { imagesToPdf, mergePdfs, extractPages, parsePageRanges } from '../services/pdfTools.js';
import { createZip, crc32 } from '../utils/zipStore.js';

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✅' : '  ❌'} ${msg}`); if (!cond) failed += 1; };
const rnd = () => path.join(TOOLS_DIR, `selftest-${crypto.randomUUID()}`);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

// a photo-like image (noise + gradients) so that compression actually has work to do
async function makePhoto(w, h) {
  const noise = Buffer.alloc(w * h * 3);
  for (let i = 0; i < noise.length; i += 1) noise[i] = (Math.random() * 255) | 0;
  const p = `${rnd()}.jpg`;
  await sharp(noise, { raw: { width: w, height: h, channels: 3 } }).blur(2).jpeg({ quality: 95 }).toFile(p);
  return p;
}

console.log('\n▶ Image compressor');
const photo = await makePhoto(3000, 2000);
const originalSize = (await fsp.stat(photo)).size;
console.log(`  source: 3000x2000, ${kb(originalSize)}`);
for (const targetKb of [500, 100, 50, 20]) {
  const r = await compressToTarget(photo, { targetBytes: targetKb * 1024, format: 'jpeg' });
  ok(r.buffer.length <= targetKb * 1024 && r.targetMet, `target ${targetKb} KB -> ${kb(r.buffer.length)} (${r.width}x${r.height}, q${r.quality})`);
}
const web = await compressToTarget(photo, { targetBytes: 80 * 1024, format: 'webp' });
ok(web.buffer.length <= 80 * 1024, `webp target 80 KB -> ${kb(web.buffer.length)}`);
const impossible = await compressToTarget(photo, { targetBytes: 300, format: 'jpeg' });
ok(impossible.targetMet === false && impossible.buffer.length > 0, `impossible 0.3 KB target returns best effort (${kb(impossible.buffer.length)}, targetMet=false)`);

console.log('\n▶ Exam photo (fixed pixels + max KB)');
const exam = await compressToTarget(photo, { targetBytes: 50 * 1024, format: 'jpeg', fixed: { width: 200, height: 230, fit: 'cover' } });
const examMeta = await sharp(exam.buffer).metadata();
ok(examMeta.width === 200 && examMeta.height === 230 && exam.buffer.length <= 50 * 1024, `200x230 px <= 50 KB -> ${examMeta.width}x${examMeta.height}, ${kb(exam.buffer.length)}`);

console.log('\n▶ Resize / convert');
const r1 = await resizeImage(photo, { mode: 'dimensions', width: 800 });
const m1 = await sharp(r1.buffer).metadata();
ok(m1.width === 800 && m1.height === 533, `width 800 keeps aspect -> ${m1.width}x${m1.height}`);
const r2 = await resizeImage(photo, { mode: 'percent', percent: 50 });
const m2 = await sharp(r2.buffer).metadata();
ok(m2.width === 1500 && m2.height === 1000, `50% -> ${m2.width}x${m2.height}`);
const r3 = await resizeImage(photo, { mode: 'dimensions', width: 300, height: 300, fit: 'cover' });
const m3 = await sharp(r3.buffer).metadata();
ok(m3.width === 300 && m3.height === 300, `300x300 cover -> ${m3.width}x${m3.height}`);
let bigErr = null;
try { await resizeImage(photo, { mode: 'dimensions', width: 9000, height: 9000 }); } catch (e) { bigErr = e; }
ok(bigErr && bigErr.statusCode === 400, 'oversized output (9000x9000) is rejected');
for (const fmt of ['png', 'webp', 'avif', 'jpeg']) {
  const c = await convertImage(photo, { format: fmt });
  const cm = await sharp(c.buffer).metadata();
  ok(cm.format === (fmt === 'avif' ? 'heif' : fmt), `convert -> ${fmt} (${kb(c.buffer.length)})`);
}
const fake = `${rnd()}.jpg`;
await fsp.writeFile(fake, 'this is definitely not an image');
let fakeErr = null;
try { await inspectImage(fake); } catch (e) { fakeErr = e; }
ok(fakeErr && fakeErr.statusCode === 400, 'fake image file is rejected by content sniffing');
const svg = `${rnd()}.svg`;
await fsp.writeFile(svg, '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
let svgErr = null;
try { await inspectImage(svg); } catch (e) { svgErr = e; }
ok(svgErr && [400, 415].includes(svgErr.statusCode), 'SVG input is rejected');

console.log('\n▶ PDF tools');
const pngPath = `${rnd()}.png`;
await sharp({ create: { width: 400, height: 600, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } } }).png().toFile(pngPath);
const pdfBuf = await imagesToPdf([photo, pngPath, photo], { pageSize: 'a4', margin: 'small' });
const pdfDoc = await PDFDocument.load(pdfBuf);
ok(pdfDoc.getPageCount() === 3, `images -> PDF has ${pdfDoc.getPageCount()} pages (${kb(pdfBuf.length)})`);
const p1 = pdfDoc.getPage(0).getSize();
ok(Math.round(p1.width) === 842 && Math.round(p1.height) === 595, 'landscape image gets a landscape A4 page');
const pdfA = `${rnd()}.pdf`; const pdfB = `${rnd()}.pdf`;
await fsp.writeFile(pdfA, pdfBuf);
await fsp.writeFile(pdfB, await imagesToPdf([pngPath, pngPath], { pageSize: 'fit', margin: 'none' }));
const merged = await mergePdfs([pdfA, pdfB], { maxPages: 100 });
ok(merged.pages === 5, `merge 3+2 pages -> ${merged.pages} pages`);
const mergedPath = `${rnd()}.pdf`;
await fsp.writeFile(mergedPath, merged.buffer);
const ex = await extractPages(mergedPath, '1-2, 5', { maxPages: 100 });
ok((await PDFDocument.load(ex.buffer)).getPageCount() === 3, 'extract "1-2, 5" -> 3 pages');
ok(JSON.stringify(parsePageRanges('3,1-2,2', 5)) === '[2,0,1]', 'page-range parser keeps order and removes duplicates');
for (const bad of ['0', '3-1', 'abc', '9']) {
  let e = null; try { parsePageRanges(bad, 5); } catch (err) { e = err; }
  ok(e && e.statusCode === 400, `page range "${bad}" rejected`);
}
const notPdf = `${rnd()}.pdf`; await fsp.writeFile(notPdf, 'nope');
let e2 = null; try { await mergePdfs([notPdf, pdfA], { maxPages: 10 }); } catch (err) { e2 = err; }
ok(e2 && e2.statusCode === 400, 'non-PDF file rejected in merge');

console.log('\n▶ ZIP writer');
const zipBytes = createZip([{ name: 'a.txt', data: Buffer.from('hello') }, { name: 'b/ü.txt', data: Buffer.from('world!') }]);
const zipPath = `${rnd()}.zip`;
await fsp.writeFile(zipPath, zipBytes);
ok(crc32(Buffer.from('123456789')) === 0xcbf43926, 'CRC-32 check value');
console.log(`  zip written: ${zipPath}`);

const shouldTestVideo = process.env.FFMPEG_PATH || process.argv.includes('--video');
if (shouldTestVideo) {
  console.log('\n▶ Video compressor (ffmpeg)');
  const { spawnSync } = await import('node:child_process');
  const bin = process.env.FFMPEG_PATH || 'ffmpeg';
  const src = `${rnd()}.mp4`;
  const gen = spawnSync(bin, ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '20',
    '-c:v', 'libx264', '-b:v', '4000k', '-c:a', 'aac', src], { stdio: 'ignore' });
  if (gen.status === 0) {
    const { createVideoJob, getJobFor, publicJob } = await import('../services/videoService.js');
    const { TOOL_LIMITS } = await import('../config/constants.js');
    const size = (await fsp.stat(src)).size;
    const target = Math.round(size * 0.3);
    const src2 = `${rnd()}.mp4`; await fsp.copyFile(src, src2); // each job deletes its own input
    console.log(`  source 20s 720p: ${kb(size)} -> target ${kb(target)}`);
    const job = await createVideoJob({ userId: 'selftest', inputPath: src, originalName: 'x.mp4', originalBytes: size, targetBytes: target, resolution: 'auto', limits: TOOL_LIMITS.pro, quota: null });
    while (!['done', 'failed'].includes(getJobFor('selftest', job.id).status)) await new Promise((r) => setTimeout(r, 300));
    const pj = publicJob(job);
    ok(pj.status === 'done' && pj.resultBytes <= target, `video job ${pj.status}: ${kb(pj.resultBytes || 0)} <= ${kb(target)} (targetMet=${pj.targetMet})`);
    const j2 = await createVideoJob({ userId: 'selftest', inputPath: src2, originalName: 'x.mp4', originalBytes: size, targetBytes: size * 2, resolution: 'auto', limits: TOOL_LIMITS.pro, quota: null });
    while (!['done', 'failed'].includes(j2.status)) await new Promise((r) => setTimeout(r, 200));
    ok(j2.status === 'failed' && j2.errorCode === 'ALREADY_SMALLER', 'target larger than the source is rejected with a clear message');
  } else console.log('  (could not generate a test video, skipping)');
}

console.log(failed ? `\n❌ ${failed} check(s) failed` : '\n✅ All tool checks passed');
process.exit(failed ? 1 : 0);
