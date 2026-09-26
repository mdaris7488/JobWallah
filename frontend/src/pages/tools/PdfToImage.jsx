import { useEffect, useRef, useState } from 'react';
import FileDrop from '../../components/tools/FileDrop';
import { Field, Select } from '../../components/common';
import { createZip } from '../../utils/zipStore';
import { formatBytes } from '../../utils/format';

const MAX_PAGES = 200;
const MAX_PIXELS = 36_000_000; // per page, keeps the browser from running out of memory

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

const explain = (err) => {
  if (err?.name === 'PasswordException') return 'This PDF is password protected. Remove the password first.';
  if (err?.name === 'InvalidPDFException') return 'This file is not a valid PDF.';
  return err?.message || 'Could not convert this PDF.';
};

/** Runs 100% in the browser: the PDF is never uploaded, so it is private and has no server limits. */
export default function PdfToImage() {
  const [files, setFiles] = useState([]);
  const [format, setFormat] = useState('png');
  const [dpi, setDpi] = useState('150');
  const [status, setStatus] = useState({ busy: false, done: 0, total: 0, error: '' });
  const [pages, setPages] = useState([]);
  const pagesRef = useRef([]);
  const cancelRef = useRef(false);
  pagesRef.current = pages;

  const clearPages = () => { pagesRef.current.forEach((p) => URL.revokeObjectURL(p.url)); setPages([]); };
  useEffect(() => () => { cancelRef.current = true; pagesRef.current.forEach((p) => URL.revokeObjectURL(p.url)); }, []);

  const convert = async (e) => {
    e.preventDefault();
    if (!files.length) { setStatus((s) => ({ ...s, error: 'Please choose a PDF first.' })); return; }
    clearPages();
    cancelRef.current = false;
    setStatus({ busy: true, done: 0, total: 0, error: '' });
    let doc;
    try {
      const pdfjs = await loadPdfjs();
      const data = new Uint8Array(await files[0].arrayBuffer());
      doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
      if (doc.numPages > MAX_PAGES) throw new Error(`This PDF has ${doc.numPages} pages. The limit is ${MAX_PAGES} pages.`);
      setStatus((s) => ({ ...s, total: doc.numPages }));

      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const stem = files[0].name.replace(/\.pdf$/i, '').replace(/[^\w-]+/g, '-').slice(0, 50) || 'page';
      for (let i = 1; i <= doc.numPages; i += 1) {
        if (cancelRef.current) break;
        const page = await doc.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(Number(dpi) / 72, Math.sqrt(MAX_PIXELS / (base.width * base.height)));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.92));
        canvas.width = 0; canvas.height = 0; // release the bitmap
        page.cleanup();
        if (!blob) throw new Error('Your browser could not create the image.');
        const item = { n: i, blob, url: URL.createObjectURL(blob), name: `${stem}-page-${i}.${format === 'png' ? 'png' : 'jpg'}` };
        setPages((prev) => [...prev, item]);
        setStatus((s) => ({ ...s, done: i }));
      }
    } catch (err) {
      setStatus((s) => ({ ...s, error: explain(err) }));
    } finally {
      if (doc) doc.destroy();
      setStatus((s) => ({ ...s, busy: false }));
    }
  };

  const downloadZip = async () => {
    const entries = await Promise.all(pages.map(async (p) => ({ name: p.name, data: new Uint8Array(await p.blob.arrayBuffer()) })));
    const url = URL.createObjectURL(new Blob([createZip(entries)], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'pdf-pages.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <div className="form">
      <form className="form" onSubmit={convert}>
        <FileDrop files={files} onChange={(f) => { setFiles(f); clearPages(); }} accept="application/pdf,.pdf" maxMb={100}
          label="Choose a PDF or drop it here" hint={`Up to ${MAX_PAGES} pages · nothing is uploaded, it all happens on your device`} />
        <div className="form-grid">
          <Field label="Image format"><Select value={format} onChange={setFormat} options={[{ value: 'png', label: 'PNG (sharp text)' }, { value: 'jpeg', label: 'JPG (smaller files)' }]} /></Field>
          <Field label="Quality"><Select value={dpi} onChange={setDpi} options={[{ value: '72', label: 'Small (72 dpi)' }, { value: '150', label: 'Good (150 dpi)' }, { value: '200', label: 'High (200 dpi)' }]} /></Field>
        </div>
        {status.error && <div className="form-error" role="alert">{status.error}</div>}
        {status.busy && (
          <div className="progress-wrap" role="status">
            <div className="progress"><span style={{ width: `${status.total ? (status.done / status.total) * 100 : 4}%` }} /></div>
            <span className="muted small">Converting page {status.done} of {status.total || '…'}</span>
          </div>
        )}
        <button className="btn btn-accent" disabled={status.busy}>{status.busy ? 'Converting…' : 'Convert to images'}</button>
      </form>

      {pages.length > 0 && (
        <div className="result">
          <div className="row-between">
            <h2 className="panel-title">{pages.length} page{pages.length > 1 ? 's' : ''} ready</h2>
            {pages.length > 1 && !status.busy && <button type="button" className="btn btn-primary btn-sm" onClick={downloadZip}>Download all (ZIP)</button>}
          </div>
          <ul className="page-grid">
            {pages.map((p) => (
              <li key={p.n}>
                <img src={p.url} alt={`Page ${p.n}`} loading="lazy" />
                <span className="muted small">Page {p.n} · {formatBytes(p.blob.size)}</span>
                <a className="btn btn-ghost btn-sm" href={p.url} download={p.name}>Download</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
