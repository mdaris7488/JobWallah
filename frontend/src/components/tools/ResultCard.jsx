import { useEffect, useState } from 'react';
import { formatBytes } from '../../utils/format';

export default function ResultCard({ result, onReset }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(result.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [result]);

  const { meta } = result;
  const saved = meta.originalBytes ? Math.round((1 - result.blob.size / meta.originalBytes) * 100) : null;
  const isImage = result.contentType?.startsWith('image/');

  return (
    <div className="result">
      <h2 className="panel-title">Done!</h2>
      {isImage && url && <img className="result-preview" src={url} alt="Result preview" />}
      <dl className="result-stats">
        {meta.originalBytes > 0 && <div><dt>Original</dt><dd>{formatBytes(meta.originalBytes)}</dd></div>}
        <div><dt>New size</dt><dd>{formatBytes(result.blob.size)}</dd></div>
        {saved !== null && saved > 0 && <div><dt>Saved</dt><dd>{saved}%</dd></div>}
        {meta.count > 1 && <div><dt>Files</dt><dd>{meta.count} (ZIP)</dd></div>}
      </dl>
      {meta.targetMet === false && (
        <p className="notice">We could not reach your target size without making the file unusable. This is the smallest version we could make. Try a larger target.</p>
      )}
      <div className="row-actions">
        <a className="btn btn-accent" href={url} download={result.filename}>Download {result.filename}</a>
        <button type="button" className="btn btn-ghost" onClick={onReset}>Start over</button>
      </div>
    </div>
  );
}
