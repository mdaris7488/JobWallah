import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { adminApi, downloadApplicantsCsv } from '../../api';
import { getErrorMessage } from '../../api/http';
import { useFetch } from '../../utils/useFetch';
import { showToast } from '../../store/uiSlice';
import { Loading, ErrorBox, Empty, Pagination, Select } from '../../components/common';
import { CATEGORIES } from '../../utils/constants';
import { formatDate } from '../../utils/format';

const dateTime = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Everyone who pressed "Apply" - with their profile details, the job and its category. */
export default function AdminApplications() {
  const dispatch = useDispatch();
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [q, setQ] = useState(get('q'));
  const [exporting, setExporting] = useState(false);
  const filters = { job: get('job'), category: get('category'), sector: get('sector'), q: get('q') };

  const { data, meta, loading, error, reload } = useFetch(() => adminApi.applicants({ ...filters, page, limit: 15 }), [params.toString()]);

  const setParam = (k, v) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); setParams(n); };
  const exportCsv = async () => {
    setExporting(true);
    try { await downloadApplicantsCsv(filters); }
    catch (err) { dispatch(showToast({ type: 'error', message: getErrorMessage(err) })); }
    finally { setExporting(false); }
  };

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div><h1>Applicants</h1><p className="muted">Users who clicked Apply and were sent to the company's official page.</p></div>
        <button className="btn btn-ghost" onClick={exportCsv} disabled={exporting}>{exporting ? 'Preparing…' : 'Export CSV'}</button>
      </div>

      <form className="filters" onSubmit={(e) => { e.preventDefault(); setParam('q', q.trim()); }}>
        <input type="search" placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} />
        <Select value={get('category')} onChange={(v) => setParam('category', v)} options={CATEGORIES} placeholder="All categories" aria-label="Category" />
        <Select value={get('sector')} onChange={(v) => setParam('sector', v)} placeholder="All sectors" aria-label="Sector" options={[{ value: 'government', label: 'Government' }, { value: 'private', label: 'Private' }]} />
        <button className="btn btn-primary">Search</button>
        {get('job') && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParam('job', '')}>Clear job filter ✕</button>}
      </form>

      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.length ? <Empty title="No applicants yet" hint="They will appear here as soon as someone clicks Apply on a job." /> : (
        <div className="table-wrap">
          <table className="grid">
            <thead><tr><th>Applicant</th><th>Contact</th><th>Profile</th><th>Job</th><th>Category</th><th>Clicks</th><th>Last clicked</th></tr></thead>
            <tbody>
              {data.map((a) => (
                <tr key={a._id}>
                  <td><strong>{a.user?.name || 'Deleted user'}</strong></td>
                  <td><div>{a.user?.email}</div><div className="muted small">{a.user?.phone || 'No phone'}</div></td>
                  <td className="small">{[a.user?.qualification, a.user?.state].filter(Boolean).join(' · ') || '-'}</td>
                  <td>{a.job?.title || 'Removed job'}<div className="muted small">{a.job?.organization}</div></td>
                  <td>{a.job?.category}<div className="muted small">{a.job?.sector}</div></td>
                  <td>{a.clickCount}</td>
                  <td className="small">{dateTime(a.lastClickedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {meta && <Pagination page={meta.page} pages={meta.pages} onChange={(p) => setParam('page', p)} />}
    </div>
  );
}
