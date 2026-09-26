import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../../api';
import { getErrorMessage } from '../../api/http';
import { useFetch } from '../../utils/useFetch';
import { showToast } from '../../store/uiSlice';
import { Loading, ErrorBox, Empty, Pagination } from '../../components/common';
import { formatDate } from '../../utils/format';

export default function AdminUsers() {
  const dispatch = useDispatch();
  const me = useSelector((s) => s.auth.user);
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [q, setQ] = useState(params.get('q') || '');
  const { data, meta, loading, error, reload } = useFetch(() => adminApi.users({ page, limit: 15, q: params.get('q') || '' }), [params.toString()]);

  const toggle = async (u) => {
    try {
      await adminApi.setUserActive(u._id, !u.isActive);
      dispatch(showToast({ type: 'success', message: u.isActive ? 'User disabled and signed out.' : 'User enabled.' }));
      reload();
    } catch (err) { dispatch(showToast({ type: 'error', message: getErrorMessage(err) })); }
  };

  return (
    <div className="stack-lg">
      <div className="page-head"><h1>Users</h1></div>
      <form className="filters" onSubmit={(e) => { e.preventDefault(); setParams(q.trim() ? { q: q.trim() } : {}); }}>
        <input type="search" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} />
        <button className="btn btn-primary">Search</button>
      </form>
      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.length ? <Empty title="No users found" /> : (
        <div className="table-wrap">
          <table className="grid">
            <thead><tr><th>User</th><th>Role</th><th>Joined</th><th>Last login</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.map((u) => (
                <tr key={u._id}>
                  <td><strong>{u.name}</strong><div className="muted small">{u.email}</div></td>
                  <td>{u.role}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>{u.lastLoginAt ? formatDate(u.lastLoginAt) : '-'}</td>
                  <td>{u.isActive ? <span className="badge badge-active">Active</span> : <span className="badge badge-closing-soon">Disabled</span>}</td>
                  <td>{u.role !== 'admin' && u._id !== me._id && <button className="btn btn-ghost btn-sm" onClick={() => toggle(u)}>{u.isActive ? 'Disable' : 'Enable'}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {meta && <Pagination page={meta.page} pages={meta.pages} onChange={(p) => setParams({ ...(params.get('q') ? { q: params.get('q') } : {}), page: p })} />}
    </div>
  );
}
