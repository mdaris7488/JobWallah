import { Link } from 'react-router-dom';
import ResultCard from './ResultCard';

/** Shows upload/processing progress, a friendly error (with upgrade link when relevant) or the finished result. */
export default function RunStatus({ state, onReset }) {
  const { busy, progress, error, code, result } = state;
  if (result) return <ResultCard result={result} onReset={onReset} />;
  return (
    <>
      {busy && (
        <div className="progress-wrap" role="status">
          <div className="progress"><span style={{ width: `${progress < 100 ? progress : 100}%` }} className={progress >= 100 ? 'progress-pulse' : ''} /></div>
          <span className="muted small">{progress < 100 ? `Uploading… ${progress}%` : 'Processing… this can take a few seconds'}</span>
        </div>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
          {['UPGRADE_REQUIRED', 'DAILY_LIMIT', 'FILE_TOO_LARGE'].includes(code) && <> <Link to="/pricing" className="link-strong">See plans</Link></>}
        </div>
      )}
    </>
  );
}
