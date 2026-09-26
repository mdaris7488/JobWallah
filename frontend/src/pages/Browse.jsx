import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { jobsApi, updatesApi } from '../api';
import { useFetch } from '../utils/useFetch';
import { Loading, ErrorBox, Empty, Pagination } from '../components/common';
import { CATEGORIES, STATES } from '../utils/constants';
import { formatDate, formatNumber, safeUrl } from '../utils/format';

export function StatesPage() {
  const { data, loading, error, reload } = useFetch(() => jobsApi.stats(), []);
  const count = (s) => data?.states.find((x) => x.state === s)?.jobs || 0;
  const sorted = [...STATES].sort((a, b) => count(b) - count(a) || a.localeCompare(b));
  return (
    <div className="container page">
      <div className="page-head"><div><h1>Jobs by State</h1><p className="muted">Open listings in every state and union territory.</p></div></div>
      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <div className="tiles tiles-4">
          {sorted.map((s) => (
            <Link key={s} className={`tile tile-row ${count(s) ? '' : 'tile-dim'}`} to={`/jobs?state=${encodeURIComponent(s)}`}>
              <strong>{s}</strong><span className="count">{formatNumber(count(s))}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoriesPage() {
  const { data, loading, error, reload } = useFetch(() => jobsApi.stats(), []);
  const stat = (c) => data?.categories.find((x) => x.category === c);
  return (
    <div className="container page">
      <div className="page-head"><div><h1>Jobs by Category</h1><p className="muted">Pick the field you are preparing for.</p></div></div>
      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <div className="tiles">
          {CATEGORIES.map((c) => (
            <Link key={c} className="tile" to={`/jobs?category=${encodeURIComponent(c)}`}>
              <strong>{c}</strong>
              <span className="muted small">{formatNumber(stat(c)?.jobs)} active jobs{stat(c)?.vacancies ? ` · ${formatNumber(stat(c).vacancies)} vacancies` : ''}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function UpdatesPage({ type }) {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, meta, loading, error, reload } = useFetch(() => updatesApi.list({ type, page, limit: 15 }), [type, page]);
  const isAdmit = type === 'admit_card';
  return (
    <div className="container page">
      <div className="page-head"><div>
        <h1>{isAdmit ? 'Admit Cards' : 'Results'}</h1>
        <p className="muted">{isAdmit ? 'Download hall tickets straight from the official source.' : 'Check your result on the official website.'}</p>
      </div></div>
      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : data.length === 0 ? <Empty title="No updates yet" /> : (
        <div className="panel">
          <ul className="update-list">
            {data.map((u) => (
              <li key={u._id}>
                <span>
                  {u.job ? <Link to={`/jobs/${u.job.slug}`}>{u.title}</Link> : u.title}
                  <span className="muted small"> · {formatDate(u.publishedAt)}</span>
                </span>
                <a className="btn btn-ghost btn-sm" href={safeUrl(u.link)} target="_blank" rel="noopener noreferrer">{isAdmit ? 'Download' : 'Check'}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {meta && <Pagination page={meta.page} pages={meta.pages} onChange={(p) => setParams({ page: p })} />}
    </div>
  );
}
