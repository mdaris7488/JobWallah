import { useEffect, useMemo, useRef, useState } from 'react';
import { formatBytes } from '../../utils/format';

const matches = (file, accept) => {
  const list = accept.split(',').map((s) => s.trim().toLowerCase());
  const type = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();
  return list.some((a) => (a.startsWith('.') ? name.endsWith(a) : a.endsWith('/*') ? type.startsWith(a.slice(0, -1)) : type === a));
};

/** Click or drag & drop. Validates type and size in the browser (the server validates again). */
export default function FileDrop({ files, onChange, accept, multiple = false, maxFiles = 1, maxMb, label, hint, reorder = false, preview = false }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');

  const urls = useMemo(() => (preview ? files.map((f) => URL.createObjectURL(f)) : []), [files, preview]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const add = (incoming) => {
    setError('');
    const picked = [];
    for (const f of incoming) {
      if (!matches(f, accept)) { setError(`"${f.name}" is not a supported file type.`); continue; }
      if (maxMb && f.size > maxMb * 1024 * 1024) { setError(`"${f.name}" is ${formatBytes(f.size)}. Your plan allows up to ${maxMb} MB per file.`); continue; }
      picked.push(f);
    }
    if (!picked.length) return;
    const next = multiple ? [...files, ...picked] : [picked[0]];
    if (next.length > maxFiles) setError(`You can add up to ${maxFiles} file${maxFiles > 1 ? 's' : ''} on your plan.`);
    onChange(next.slice(0, maxFiles));
  };

  const move = (i, d) => {
    const next = [...files];
    const [item] = next.splice(i, 1);
    next.splice(i + d, 0, item);
    onChange(next);
  };

  return (
    <div>
      <label
        className={`dropzone ${over ? 'dropzone-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add([...e.dataTransfer.files]); }}
      >
        <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={(e) => { add([...e.target.files]); e.target.value = ''; }} />
        <strong>{label || (multiple ? 'Choose files or drop them here' : 'Choose a file or drop it here')}</strong>
        {hint && <span className="muted small">{hint}</span>}
      </label>
      {error && <div className="form-error" role="alert">{error}</div>}

      {files.length > 0 && (
        <ul className="file-list">
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}-${i}`}>
              {preview && urls[i] && <img src={urls[i]} alt="" className="file-thumb" />}
              <span className="file-name">{f.name}</span>
              <span className="muted small">{formatBytes(f.size)}</span>
              <span className="row-actions">
                {reorder && files.length > 1 && (
                  <>
                    <button type="button" className="icon-btn icon-btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                    <button type="button" className="icon-btn icon-btn-sm" onClick={() => move(i, 1)} disabled={i === files.length - 1} aria-label="Move down">↓</button>
                  </>
                )}
                <button type="button" className="icon-btn icon-btn-sm" onClick={() => onChange(files.filter((_, idx) => idx !== i))} aria-label={`Remove ${f.name}`}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
