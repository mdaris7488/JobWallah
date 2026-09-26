import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { adminApi } from '../../api';
import { getErrorMessage } from '../../api/http';
import { useFetch } from '../../utils/useFetch';
import { showToast } from '../../store/uiSlice';
import { Loading, ErrorBox, Empty, Field, Select } from '../../components/common';
import { formatDate } from '../../utils/format';

const BLANK = { title: '', type: 'admit_card', link: '', job: '' };

export default function AdminUpdates() {
  const dispatch = useDispatch();
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const list = useFetch(() => adminApi.updates({ limit: 50 }), []);
  const jobs = useFetch(() => adminApi.jobs({ limit: 100, sector: 'government' }), []);
  const notify = (type, message) => dispatch(showToast({ type, message }));

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminApi.createUpdate({ title: form.title.trim(), type: form.type, link: form.link.trim(), job: form.job || null });
      notify('success', 'Update published.');
      setForm(BLANK);
      list.reload();
    } catch (err) { notify('error', getErrorMessage(err)); }
    finally { setBusy(false); }
  };
  const remove = async (u) => {
    if (!window.confirm(`Delete "${u.title}"?`)) return;
    try { await adminApi.deleteUpdate(u._id); notify('success', 'Update deleted.'); list.reload(); }
    catch (err) { notify('error', getErrorMessage(err)); }
  };

  return (
    <div className="stack-lg">
      <div className="page-head"><h1>Admit cards &amp; results</h1></div>
      <form className="panel form-grid" onSubmit={create}>
        <Field label="Title"><input required minLength={3} maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="SSC CHSL Tier 1 Admit Card" /></Field>
        <Field label="Type"><Select value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={[{ value: 'admit_card', label: 'Admit card' }, { value: 'result', label: 'Result' }]} /></Field>
        <Field label="Official link"><input type="url" required maxLength={500} value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://…" /></Field>
        <Field label="Related exam (used for follower alerts)"><Select value={form.job} onChange={(v) => setForm({ ...form, job: v })} placeholder="None" options={(jobs.data || []).map((j) => ({ value: j._id, label: j.title }))} /></Field>
        <div><button className="btn btn-accent" disabled={busy}>{busy ? 'Publishing…' : 'Publish update'}</button></div>
      </form>

      {list.loading ? <Loading /> : list.error ? <ErrorBox message={list.error} onRetry={list.reload} /> : !list.data.length ? <Empty title="No updates yet" /> : (
        <div className="panel">
          <ul className="rows">
            {list.data.map((u) => (
              <li key={u._id}>
                <div><strong>{u.title}</strong><div className="muted small">{u.type === 'admit_card' ? 'Admit card' : 'Result'} · {formatDate(u.publishedAt)}{u.job ? ` · ${u.job.title}` : ''}</div></div>
                <button className="btn btn-danger btn-sm" onClick={() => remove(u)}>Delete</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
