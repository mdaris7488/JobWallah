import { useState } from 'react';
import FileDrop from '../../components/tools/FileDrop';
import RunStatus from '../../components/tools/RunStatus';
import { useTool } from '../../components/tools/toolContext';
import { useToolRun } from '../../components/tools/useToolRun';
import { Field, Select } from '../../components/common';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/tiff';
const SIZE_CHIPS = [['20 KB', 20], ['50 KB', 50], ['100 KB', 100], ['200 KB', 200], ['500 KB', 500], ['1 MB', 1024]];
const PRESETS = [
  { label: 'Photo - 200 x 230 px, max 50 KB', w: 200, h: 230, kb: 50 },
  { label: 'Photo - 3.5 x 4.5 cm (413 x 531 px), max 100 KB', w: 413, h: 531, kb: 100 },
  { label: 'Signature - 140 x 60 px, max 20 KB', w: 140, h: 60, kb: 20 },
  { label: 'Signature - 4 x 2 cm (472 x 236 px), max 50 KB', w: 472, h: 236, kb: 50 },
];
const BUTTON = { compress: 'Compress image', resize: 'Resize image', convert: 'Convert image', exam: 'Create exam photo' };

/** One component for the four image tools: compress / resize / convert / exam photo. */
export default function ImageTool({ mode }) {
  const { cfg } = useTool();
  const { limits, plan } = cfg.data;
  const runner = useToolRun();
  const [files, setFiles] = useState([]);
  const [formError, setFormError] = useState('');

  // compress
  const [target, setTarget] = useState('100');
  const [unit, setUnit] = useState('KB');
  const [cFormat, setCFormat] = useState('jpeg');
  // resize
  const [rMode, setRMode] = useState('dimensions');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [percent, setPercent] = useState('50');
  const [fit, setFit] = useState('inside');
  const [rFormat, setRFormat] = useState('same');
  // convert
  const [format, setFormat] = useState('webp');
  const [quality, setQuality] = useState(85);
  // exam photo
  const [preset, setPreset] = useState(0);
  const [ew, setEw] = useState(String(PRESETS[0].w));
  const [eh, setEh] = useState(String(PRESETS[0].h));
  const [ekb, setEkb] = useState(String(PRESETS[0].kb));

  const applyPreset = (i) => {
    setPreset(i);
    if (i >= 0) { setEw(String(PRESETS[i].w)); setEh(String(PRESETS[i].h)); setEkb(String(PRESETS[i].kb)); }
  };
  const reset = () => { runner.reset(); setFiles([]); setFormError(''); };

  const submit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!files.length) return setFormError('Please choose an image first.');
    const fields = {};
    let path;
    if (mode === 'compress') {
      const kb = Number(target) * (unit === 'MB' ? 1024 : 1);
      if (!Number.isFinite(kb) || kb < 5) return setFormError('Enter a target size of at least 5 KB.');
      path = 'image/compress'; Object.assign(fields, { targetKb: Math.round(kb), format: cFormat });
    } else if (mode === 'resize') {
      path = 'image/resize';
      if (rMode === 'percent') {
        if (!(Number(percent) >= 1)) return setFormError('Enter a percentage between 1 and 500.');
        Object.assign(fields, { mode: 'percent', percent });
      } else {
        if (!width && !height) return setFormError('Enter a width, a height, or both.');
        Object.assign(fields, { mode: 'dimensions', width, height, fit });
      }
      fields.format = rFormat;
    } else if (mode === 'convert') {
      path = 'image/convert'; Object.assign(fields, { format, quality });
    } else {
      if (!(Number(ew) >= 20 && Number(eh) >= 20 && Number(ekb) >= 5)) return setFormError('Enter a valid width, height and maximum size.');
      path = 'image/exam-photo'; Object.assign(fields, { width: ew, height: eh, maxKb: ekb });
    }
    return runner.run(path, () => {
      const fd = new FormData();
      Object.entries(fields).forEach(([k, v]) => { if (v !== '' && v !== undefined) fd.append(k, v); });
      files.forEach((f) => fd.append('files', f)); // fields first, files last
      return fd;
    });
  };

  if (runner.result) return <RunStatus state={runner} onReset={reset} />;

  return (
    <form className="form" onSubmit={submit}>
      <FileDrop
        files={files} onChange={setFiles} accept={ACCEPT} multiple={limits.maxFiles > 1} maxFiles={limits.maxFiles} maxMb={limits.maxImageMb}
        label={limits.maxFiles > 1 ? 'Choose images or drop them here' : 'Choose an image or drop it here'} preview
        hint={`JPG, PNG, WebP, GIF, AVIF, TIFF · up to ${limits.maxImageMb} MB${limits.maxFiles > 1 ? ` · up to ${limits.maxFiles} files (downloaded as ZIP)` : ''}`}
      />
      {limits.maxFiles === 1 && plan === 'free' && <p className="muted small">Need to process many images at once? Pro users can add up to 20 files and get a ZIP.</p>}

      {mode === 'compress' && (
        <>
          <Field label="I want the image to be at most…">
            <div className="inline-fields">
              <input type="number" min="1" step="any" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Target size" />
              <Select value={unit} onChange={setUnit} options={['KB', 'MB']} aria-label="Unit" />
            </div>
          </Field>
          <div className="chips">
            {SIZE_CHIPS.map(([label, kb]) => (
              <button type="button" key={label} className="chip chip-btn" onClick={() => { if (kb === 1024) { setTarget('1'); setUnit('MB'); } else { setTarget(String(kb)); setUnit('KB'); } }}>{label}</button>
            ))}
          </div>
          <Field label="Output format" hint="JPG works everywhere. WebP is smaller at the same quality.">
            <Select value={cFormat} onChange={setCFormat} options={[{ value: 'jpeg', label: 'JPG' }, { value: 'webp', label: 'WebP' }]} />
          </Field>
        </>
      )}

      {mode === 'resize' && (
        <>
          <div className="seg" role="radiogroup" aria-label="Resize by">
            {[['dimensions', 'By pixels'], ['percent', 'By percentage']].map(([v, l]) => (
              <label key={v} className={rMode === v ? 'on' : ''}><input type="radio" name="rmode" checked={rMode === v} onChange={() => setRMode(v)} />{l}</label>
            ))}
          </div>
          {rMode === 'dimensions' ? (
            <>
              <div className="form-grid">
                <Field label="Width (px)"><input type="number" min="1" max="10000" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="e.g. 800" /></Field>
                <Field label="Height (px)" hint="Leave one empty to keep the aspect ratio."><input type="number" min="1" max="10000" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 600" /></Field>
              </div>
              {width && height && (
                <Field label="When both are set">
                  <Select value={fit} onChange={setFit} options={[{ value: 'inside', label: 'Fit inside (keep proportions)' }, { value: 'cover', label: 'Fill and crop' }, { value: 'fill', label: 'Stretch to exact size' }]} />
                </Field>
              )}
            </>
          ) : (
            <Field label="Scale to (%)"><input type="number" min="1" max="500" value={percent} onChange={(e) => setPercent(e.target.value)} /></Field>
          )}
          <Field label="Output format">
            <Select value={rFormat} onChange={setRFormat} options={[{ value: 'same', label: 'Same as original' }, { value: 'jpeg', label: 'JPG' }, { value: 'png', label: 'PNG' }, { value: 'webp', label: 'WebP' }]} />
          </Field>
        </>
      )}

      {mode === 'convert' && (
        <>
          <Field label="Convert to">
            <Select value={format} onChange={setFormat} options={[{ value: 'jpeg', label: 'JPG' }, { value: 'png', label: 'PNG' }, { value: 'webp', label: 'WebP' }, { value: 'avif', label: 'AVIF' }]} />
          </Field>
          {format !== 'png' && (
            <Field label={`Quality: ${quality}`}><input type="range" min="30" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} /></Field>
          )}
        </>
      )}

      {mode === 'exam' && (
        <>
          <Field label="Preset" hint="These are common examples. Always check the exact size in your exam notification.">
            <Select value={preset} onChange={(v) => applyPreset(Number(v))} options={[...PRESETS.map((p, i) => ({ value: i, label: p.label })), { value: -1, label: 'Custom size' }]} />
          </Field>
          <div className="form-grid three">
            <Field label="Width (px)"><input type="number" min="20" max="3000" value={ew} onChange={(e) => { setEw(e.target.value); setPreset(-1); }} /></Field>
            <Field label="Height (px)"><input type="number" min="20" max="3000" value={eh} onChange={(e) => { setEh(e.target.value); setPreset(-1); }} /></Field>
            <Field label="Max size (KB)"><input type="number" min="5" max="1024" value={ekb} onChange={(e) => { setEkb(e.target.value); setPreset(-1); }} /></Field>
          </div>
        </>
      )}

      {formError && <div className="form-error" role="alert">{formError}</div>}
      <RunStatus state={runner} onReset={reset} />
      <button className="btn btn-accent" disabled={runner.busy}>{runner.busy ? 'Working…' : BUTTON[mode]}</button>
    </form>
  );
}
