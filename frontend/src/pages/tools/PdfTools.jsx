import { useState } from 'react';
import FileDrop from '../../components/tools/FileDrop';
import RunStatus from '../../components/tools/RunStatus';
import { useTool } from '../../components/tools/toolContext';
import { useToolRun } from '../../components/tools/useToolRun';
import { Field, Select } from '../../components/common';

const IMAGES = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/tiff';

function useForm() {
  const { cfg } = useTool();
  const runner = useToolRun();
  const [files, setFiles] = useState([]);
  const [formError, setFormError] = useState('');
  const reset = () => { runner.reset(); setFiles([]); setFormError(''); };
  const send = (path, fields) => runner.run(path, () => {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => { if (v !== '' && v !== undefined) fd.append(k, v); });
    files.forEach((f) => fd.append('files', f));
    return fd;
  });
  return { limits: cfg.data.limits, runner, files, setFiles, formError, setFormError, reset, send };
}

export function ImagesToPdf() {
  const t = useForm();
  const [pageSize, setPageSize] = useState('a4');
  const [margin, setMargin] = useState('small');
  const [orientation, setOrientation] = useState('auto');
  if (t.runner.result) return <RunStatus state={t.runner} onReset={t.reset} />;
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); if (!t.files.length) return t.setFormError('Add at least one image.'); t.setFormError(''); return t.send('pdf/from-images', { pageSize, margin, orientation }); }}>
      <FileDrop files={t.files} onChange={t.setFiles} accept={IMAGES} multiple maxFiles={t.limits.maxPdfImages} maxMb={t.limits.maxImageMb} reorder preview
        label="Choose images or drop them here" hint={`Up to ${t.limits.maxPdfImages} images, ${t.limits.maxImageMb} MB each. Use the arrows to set the page order.`} />
      <div className="form-grid three">
        <Field label="Page size"><Select value={pageSize} onChange={setPageSize} options={[{ value: 'a4', label: 'A4' }, { value: 'fit', label: 'Same as image' }]} /></Field>
        <Field label="Margin"><Select value={margin} onChange={setMargin} options={[{ value: 'none', label: 'None' }, { value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }]} /></Field>
        <Field label="Orientation"><Select value={orientation} onChange={setOrientation} options={[{ value: 'auto', label: 'Automatic' }, { value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]} /></Field>
      </div>
      {t.formError && <div className="form-error" role="alert">{t.formError}</div>}
      <RunStatus state={t.runner} onReset={t.reset} />
      <button className="btn btn-accent" disabled={t.runner.busy}>{t.runner.busy ? 'Working…' : 'Create PDF'}</button>
    </form>
  );
}

export function PdfMerge() {
  const t = useForm();
  if (t.runner.result) return <RunStatus state={t.runner} onReset={t.reset} />;
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); if (t.files.length < 2) return t.setFormError('Add at least two PDF files.'); t.setFormError(''); return t.send('pdf/merge', {}); }}>
      <FileDrop files={t.files} onChange={t.setFiles} accept="application/pdf,.pdf" multiple maxFiles={t.limits.maxFiles} maxMb={t.limits.maxPdfMb} reorder
        label="Choose PDF files or drop them here" hint={`Up to ${t.limits.maxFiles} files, ${t.limits.maxPdfMb} MB each. Order = merge order.`} />
      {t.formError && <div className="form-error" role="alert">{t.formError}</div>}
      <RunStatus state={t.runner} onReset={t.reset} />
      <button className="btn btn-accent" disabled={t.runner.busy}>{t.runner.busy ? 'Working…' : 'Merge PDFs'}</button>
    </form>
  );
}

export function PdfExtract() {
  const t = useForm();
  const [ranges, setRanges] = useState('');
  if (t.runner.result) return <RunStatus state={t.runner} onReset={t.reset} />;
  return (
    <form className="form" onSubmit={(e) => {
      e.preventDefault();
      if (!t.files.length) return t.setFormError('Please choose a PDF first.');
      if (!ranges.trim()) return t.setFormError('Enter the pages to keep, e.g. 1-3, 5.');
      t.setFormError('');
      return t.send('pdf/extract', { ranges });
    }}>
      <FileDrop files={t.files} onChange={t.setFiles} accept="application/pdf,.pdf" maxMb={t.limits.maxPdfMb}
        label="Choose a PDF or drop it here" hint={`Up to ${t.limits.maxPdfMb} MB. Password-protected PDFs are not supported.`} />
      <Field label="Pages to keep" hint="Example: 1-3, 5, 8-10 (the order you type is the order in the new PDF)">
        <input value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="1-3, 5, 8-10" maxLength={300} />
      </Field>
      {t.formError && <div className="form-error" role="alert">{t.formError}</div>}
      <RunStatus state={t.runner} onReset={t.reset} />
      <button className="btn btn-accent" disabled={t.runner.busy}>{t.runner.busy ? 'Working…' : 'Extract pages'}</button>
    </form>
  );
}
