import { useEffect, useRef, useState } from 'react';
import { jobsApi } from '../api';

/**
 * Search-as-you-type picker for the Single Exam Pass. Searches ALL published government jobs directly
 * (does not require the user to have "followed" anything first — that was the old, broken flow).
 */
export default function ExamPicker({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [selectedTitle, setSelectedTitle] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onClickAway = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      jobsApi.list({ sector: 'government', status: 'active', q: query.trim() || undefined, limit: 8 })
        .then((res) => { if (alive) setResults(res.data.data); })
        .catch(() => { if (alive) setResults([]); })
        .finally(() => { if (alive) setLoading(false); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [query, open]);

  const pick = (job) => {
    onChange(job._id);
    setSelectedTitle(job.title);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="exam-picker" ref={boxRef}>
      {value && selectedTitle ? (
        <div className="exam-picked">
          <span>{selectedTitle}</span>
          <button
            type="button"
            className="link-strong"
            onMouseDown={(e) => { e.preventDefault(); onChange(''); setSelectedTitle(''); }}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search by exam name, e.g. SSC CGL"
            autoComplete="off"
          />
          {open && (
            <div className="exam-dropdown">
              {loading ? (
                <div className="exam-dropdown-msg">Searching…</div>
              ) : results.length ? (
                results.map((j) => (
                  <button
                    type="button"
                    key={j._id}
                    className="exam-option"
                    onMouseDown={(e) => { e.preventDefault(); pick(j); }}
                  >
                    <strong>{j.title}</strong>
                    <span className="muted small">{j.organization}</span>
                  </button>
                ))
              ) : (
                <div className="exam-dropdown-msg">{query.trim() ? 'No matching exam found.' : 'Start typing to search government jobs.'}</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
