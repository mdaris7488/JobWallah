import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { adminApi } from '../../api';
import { getErrorMessage } from '../../api/http';
import { useFetch } from '../../utils/useFetch';
import { showToast } from '../../store/uiSlice';
import { Loading, ErrorBox, Empty, Modal, Pagination, Select, StatusBadge } from '../../components/common';
import { CATEGORIES } from '../../utils/constants';
import { formatDate, formatNumber } from '../../utils/format';

export default function AdminJobs() {
  const dispatch = useDispatch();
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [q, setQ] = useState(get('q'));
  const [toDelete, setToDelete] = useState(null);
  const [busyId, setBusyId] = useState('');

  const { data, meta, loading, error, reload } = useFetch(
    () => adminApi.jobs({ page, limit: 10, q: get('q'), sector: get('sector'), category: get('category'), published: get('published') }),
    [params.toString()]
  );

  const setFilter = (k, v) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); n.delete('page'); setParams(n); };
  const notify = (type, message) => dispatch(showToast({ type, message }));

  const togglePublish = async (job) => {
    setBusyId(job._id);
    try { await adminApi.updateJob(job._id, { isPublished: !job.isPublished }); notify('success', job.isPublished ? 'Job unpublished.' : 'Job published.'); reload(); }
    catch (err) { notify('error', getErrorMessage(err)); }
    finally { setBusyId(''); }
  };

  const confirmDelete = async () => {
    try { await adminApi.deleteJob(toDelete._id); notify('success', 'Job deleted.'); setToDelete(null); reload(); }
    catch (err) { notify('error', getErrorMessage(err)); }
  };

  return (
    <div className="stack-lg">
      <div className="page-head"><h1>Jobs</h1><Link className="btn btn-accent" to="/admin/jobs/new">+ Add job</Link></div>

      <form className="filters" onSubmit={(e) => { e.preventDefault(); setFilter('q', q.trim()); }}>
        <input type="search" placeholder="Search title or organization" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} />
        <Select value={get('sector')} onChange={(v) => setFilter('sector', v)} placeholder="All sectors" options={[{ value: 'government', label: 'Government' }, { value: 'private', label: 'Private' }]} />
        <Select value={get('category')} onChange={(v) => setFilter('category', v)} placeholder="All categories" options={CATEGORIES} />
        <Select value={get('published')} onChange={(v) => setFilter('published', v)} placeholder="Any visibility" options={[{ value: 'true', label: 'Published' }, { value: 'false', label: 'Draft / hidden' }]} />
        <button className="btn btn-primary">Search</button>
      </form>

      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.length ? <Empty title="No jobs found" /> : (
        <div className="table-wrap">
          <table className="grid">
            <thead><tr><th>Job</th><th>Category</th><th>Last date</th><th>Visibility</th><th>Views / Apply clicks</th><th>Actions</th></tr></thead>
            <tbody>
              {data.map((j) => (
                <tr key={j._id}>
                  <td><Link className="job-title" to={`/jobs/${j.slug}`}>{j.title}</Link><div className="muted small">{j.organization}</div></td>
                  <td><strong>{j.category}</strong><div className="muted small">{j.sector}</div></td>
                  <td>{j.lastDate ? formatDate(j.lastDate) : 'No deadline'} <StatusBadge status={j.status} /></td>
                  <td>{j.isPublished ? <span className="badge badge-active">Published</span> : <span className="badge badge-expired">Hidden</span>}</td>
                  <td>{formatNumber(j.viewCount)} / <Link to={`/admin/applications?job=${j._id}`}>{formatNumber(j.applyClickCount)}</Link></td>
                  <td>
                    <div className="row-actions">
                      <Link className="btn btn-ghost btn-sm" to={`/admin/jobs/${j._id}/edit`}>Edit</Link>
                      <button className="btn btn-ghost btn-sm" disabled={busyId === j._id} onClick={() => togglePublish(j)}>{j.isPublished ? 'Unpublish' : 'Publish'}</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setToDelete(j)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {meta && <Pagination page={meta.page} pages={meta.pages} onChange={(p) => { const n = new URLSearchParams(params); n.set('page', p); setParams(n); }} />}

      {toDelete && (
        <Modal title="Delete this job?" onClose={() => setToDelete(null)}>
          <p><strong>{toDelete.title}</strong> will be removed together with its applicant history and bookmarks. This cannot be undone.</p>
          <div className="row-end">
            <button className="btn btn-ghost" onClick={() => setToDelete(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={confirmDelete}>Delete job</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
