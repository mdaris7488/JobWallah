import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { jobsApi } from '../api';
import { useFetch } from '../utils/useFetch';
import { Loading, ErrorBox, Empty, Pagination, Select } from '../components/common';
import { GovJobsTable, PrivateJobCard } from '../components/JobList';
import { CATEGORIES, QUALIFICATIONS, STATES, WORK_MODES } from '../utils/constants';
import { formatNumber } from '../utils/format';

/** One listing page for /jobs, /government-jobs and /private-jobs. Filters live in the URL (shareable, back-button friendly). */
export default function JobsPage({ sector: fixedSector }) {
  const [params, setParams] = useSearchParams();
  const sector = fixedSector || params.get('sector') || '';
  const isPrivate = sector === 'private';
  const get = (k) => params.get(k) || '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [q, setQ] = useState(get('q'));
  useEffect(() => { setQ(get('q')); }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, meta, loading, error, reload } = useFetch(
    () => jobsApi.list({
      sector, page, limit: 10, q: get('q'), state: get('state'), category: get('category'),
      qualification: get('qualification'), workMode: get('workMode'), status: get('status'),
    }),
    [sector, params.toString()]
  );

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    setParams(next);
  };
  const setPage = (p) => { const next = new URLSearchParams(params); next.set('page', p); setParams(next); };

  const title = isPrivate ? 'Private Sector Jobs' : sector === 'government' ? 'Government Jobs' : 'All Jobs';
  const sub = isPrivate ? 'Verified employers, real salaries and direct apply.' : 'Verified notifications with eligibility, dates and official links.';

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p className="muted">{sub}</p>
        </div>
        {meta && <span className="count-pill">{formatNumber(meta.total)} listings</span>}
      </div>

      <form className="filters" onSubmit={(e) => { e.preventDefault(); setFilter('q', q.trim()); }} role="search">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} placeholder="Search by title, department or company" aria-label="Search" />
        <Select value={get('state')} onChange={(v) => setFilter('state', v)} options={STATES} placeholder="All states" aria-label="State" />
        <Select value={get('category')} onChange={(v) => setFilter('category', v)} options={CATEGORIES} placeholder="All categories" aria-label="Category" />
        {isPrivate
          ? <Select value={get('workMode')} onChange={(v) => setFilter('workMode', v)} options={WORK_MODES} placeholder="Work mode" aria-label="Work mode" />
          : <Select value={get('qualification')} onChange={(v) => setFilter('qualification', v)} options={QUALIFICATIONS} placeholder="Qualification" aria-label="Qualification" />}
        <label className="check">
          <input type="checkbox" checked={get('status') === 'active'} onChange={(e) => setFilter('status', e.target.checked ? 'active' : '')} />
          Hide expired
        </label>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> :
        data.length === 0 ? <Empty title="No jobs match these filters" hint="Try removing a filter or searching a different keyword." /> :
          isPrivate ? <div className="stack">{data.map((j) => <PrivateJobCard key={j._id} job={j} />)}</div> : <GovJobsTable jobs={data} />}

      {meta && <Pagination page={meta.page} pages={meta.pages} onChange={setPage} />}
    </div>
  );
}
