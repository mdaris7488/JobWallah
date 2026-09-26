import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { meApi, subsApi, paymentsApi, downloadReceipt } from '../api';
import { getErrorMessage, setAccessToken } from '../api/http';
import { useFetch } from '../utils/useFetch';
import { saveProfile } from '../store/authSlice';
import { showToast } from '../store/uiSlice';
import { Loading, ErrorBox, Empty, StatusBadge, Field, Select } from '../components/common';
import { CATEGORIES, QUALIFICATIONS, STATES } from '../utils/constants';
import { formatDate, safeUrl } from '../utils/format';

const TABS = [
  ['saved', 'My Saved Jobs'],
  ['applications', 'Applied Jobs'],
  ['followed', 'Followed Exams'],
  ['alerts', 'Job & Result Alerts'],
  ['subscription', 'Subscription'],
  ['profile', 'Profile'],
];

function SavedJobs({ kind, empty }) {
  const dispatch = useDispatch();
  const { data, loading, error, reload } = useFetch(() => meApi.bookmarks(kind), [kind]);
  const remove = async (id) => {
    try { await meApi.removeBookmark(id, kind); reload(); } catch (err) { dispatch(showToast({ type: 'error', message: getErrorMessage(err) })); }
  };
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data.length) return <Empty title={empty.title} hint={empty.hint}><Link className="btn btn-primary btn-sm" to="/government-jobs">Browse jobs</Link></Empty>;
  return (
    <ul className="rows">
      {data.map((j) => (
        <li key={j._id}>
          <div>
            <Link className="job-title" to={`/jobs/${j.slug}`}>{j.title}</Link>
            <div className="muted small">{j.organization} · Last date {formatDate(j.lastDate)}</div>
          </div>
          <div className="row-actions">
            <StatusBadge status={j.status} />
            <button className="btn btn-ghost btn-sm" onClick={() => remove(j._id)}>{kind === 'save' ? 'Remove' : 'Unfollow'}</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Applications() {
  const { data, loading, error, reload } = useFetch(() => meApi.applications(), []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data.length) return <Empty title="No applications yet" hint="Jobs you press Apply on will be listed here so you can find them again." />;
  return (
    <ul className="rows">
      {data.map((a) => (
        <li key={a._id}>
          <div>
            {a.job ? <Link className="job-title" to={`/jobs/${a.job.slug}`}>{a.job.title}</Link> : <span>Job removed</span>}
            <div className="muted small">
              {a.job?.organization} · {a.job?.category} · Opened {formatDate(a.lastClickedAt)}{a.clickCount > 1 ? ` (${a.clickCount} times)` : ''}
            </div>
          </div>
          {a.job && <a className="btn btn-ghost btn-sm" href={safeUrl(a.job.applyUrl)} target="_blank" rel="noopener noreferrer">Open application page</a>}
        </li>
      ))}
    </ul>
  );
}

function Alerts() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const [prefs, setPrefs] = useState({ whatsapp: !!user.alertPreferences?.whatsapp, categories: user.alertPreferences?.categories || [] });
  const [saving, setSaving] = useState(false);
  const updates = useFetch(() => meApi.updates(), []);

  const toggleCat = (c) => setPrefs((p) => ({ ...p, categories: p.categories.includes(c) ? p.categories.filter((x) => x !== c) : [...p.categories, c] }));
  const save = async () => {
    setSaving(true);
    const res = await dispatch(saveProfile({ alertPreferences: prefs }));
    setSaving(false);
    dispatch(showToast(res.error ? { type: 'error', message: res.payload } : { type: 'success', message: 'Alert preferences saved.' }));
  };

  return (
    <div className="stack-lg">
      <section className="panel">
        <h2 className="panel-title">Job alert preferences</h2>
        <label className="check"><input type="checkbox" checked={prefs.whatsapp} onChange={(e) => setPrefs({ ...prefs, whatsapp: e.target.checked })} /> Send alerts on WhatsApp</label>
        <p className="muted small">Choose categories you want to hear about:</p>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <label key={c} className={`chip chip-toggle ${prefs.categories.includes(c) ? 'chip-on' : ''}`}>
              <input type="checkbox" checked={prefs.categories.includes(c)} onChange={() => toggleCat(c)} />{c}
            </label>
          ))}
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save preferences'}</button>
      </section>

      <section className="panel">
        <h2 className="panel-title">Admit card &amp; result alerts</h2>
        {updates.loading ? <Loading /> : updates.errorCode === 'UPGRADE_REQUIRED' ? (
          <Empty title="Included in Pro" hint="Get admit card and result alerts for every exam you follow.">
            <Link className="btn btn-accent btn-sm" to="/pricing">See plans</Link>
          </Empty>
        ) : updates.error ? <ErrorBox message={updates.error} onRetry={updates.reload} /> : !updates.data.length ? (
          <Empty title="No alerts yet" hint="We will list admit cards and results here for exams you follow." />
        ) : (
          <ul className="update-list">
            {updates.data.map((u) => (
              <li key={u._id}>
                <span>{u.title}<span className="muted small"> · {u.type === 'admit_card' ? 'Admit card' : 'Result'} · {formatDate(u.publishedAt)}</span></span>
                <a className="btn btn-ghost btn-sm" href={safeUrl(u.link)} target="_blank" rel="noopener noreferrer">Open</a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PaymentHistory() {
  const dispatch = useDispatch();
  const { data, loading, error, reload } = useFetch(() => paymentsApi.mine(), []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data.length) return <p className="muted small">No payments yet.</p>;
  const tone = { paid: 'badge-active', refunded: 'badge-expired', failed: 'badge-closing-soon' };
  return (
    <div className="table-wrap">
      <table className="grid">
        <thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.id}>
              <td>{formatDate(p.paidAt || p.createdAt)}</td>
              <td><strong>{p.planName}</strong>{p.exam && <div className="muted small">{p.exam.title}</div>}</td>
              <td>₹{p.amount}{p.method && <div className="muted small">{p.method.toUpperCase()}</div>}</td>
              <td><span className={`badge ${tone[p.status] || 'badge-new'}`}>{p.status}</span></td>
              <td>{p.invoiceNo
                ? <button className="btn btn-ghost btn-sm" onClick={() => downloadReceipt(p.id, p.invoiceNo).catch((e) => dispatch(showToast({ type: 'error', message: getErrorMessage(e) })))}>Download</button>
                : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Subscription() {
  const { data, loading, error, reload } = useFetch(() => subsApi.mine(), []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const now = Date.now();
  return (
    <div className="stack-lg">
      {data.subscriptions.length === 0 ? (
        <Empty title="You are on the Free plan" hint="Upgrade for unlimited exam tracking and automatic alerts.">
          <Link className="btn btn-accent btn-sm" to="/pricing">See plans</Link>
        </Empty>
      ) : (
        <ul className="rows">
          {data.subscriptions.map((s) => {
            const live = s.status === 'active' && new Date(s.endsAt).getTime() > now;
            return (
              <li key={s._id}>
                <div>
                  <strong>{s.plan.replaceAll('_', ' ')}</strong>
                  <div className="muted small">₹{s.amount} · {formatDate(s.startsAt)} to {formatDate(s.endsAt)}{s.exam ? ` · ${s.exam.title}` : ''}</div>
                </div>
                <span className={`badge ${live ? 'badge-active' : 'badge-expired'}`}>{s.status === 'cancelled' ? 'Cancelled' : live ? 'Active' : 'Ended'}</span>
              </li>
            );
          })}
        </ul>
      )}
      <Link className="link-strong" to="/pricing">Change or add a plan →</Link>
      <section>
        <h2 className="panel-title">Payment history</h2>
        <PaymentHistory />
      </section>
    </div>
  );
}

function Profile() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const [form, setForm] = useState({ name: user.name || '', phone: user.phone || '', qualification: user.qualification || '', state: user.state || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await dispatch(saveProfile(form));
    setBusy(false);
    dispatch(showToast(res.error ? { type: 'error', message: res.payload } : { type: 'success', message: 'Profile updated.' }));
  };
  const changePw = async (e) => {
    e.preventDefault();
    try {
      const { data } = await meApi.changePassword(pw);
      setAccessToken(data.data.accessToken);
      setPw({ currentPassword: '', newPassword: '' });
      dispatch(showToast({ type: 'success', message: data.message }));
    } catch (err) {
      dispatch(showToast({ type: 'error', message: getErrorMessage(err) }));
    }
  };

  return (
    <div className="stack-lg">
      <form className="panel form" onSubmit={save}>
        <h2 className="panel-title">Your details</h2>
        <Field label="Email"><input value={user.email} disabled /></Field>
        <Field label="Full name"><input required minLength={2} maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Mobile number"><input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Highest qualification"><Select value={form.qualification} onChange={(v) => setForm({ ...form, qualification: v })} options={QUALIFICATIONS} placeholder="Select" /></Field>
        <Field label="Home state"><Select value={form.state} onChange={(v) => setForm({ ...form, state: v })} options={STATES} placeholder="Select" /></Field>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>

      <form className="panel form" onSubmit={changePw}>
        <h2 className="panel-title">Change password</h2>
        <Field label="Current password"><input type="password" required autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
        <Field label="New password" hint="At least 8 characters, with a letter and a number.">
          <input type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
        </Field>
        <button className="btn btn-ghost">Update password</button>
      </form>
    </div>
  );
}

export default function Dashboard() {
  const user = useSelector((s) => s.auth.user);
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'saved';
  const summary = useFetch(() => meApi.dashboard(), [tab]);
  useEffect(() => { document.title = 'My Account · JobWallah'; }, []);

  const counts = summary.data?.counts;
  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="muted">Here's what's happening with your job search.</p>
        </div>
      </div>

      <div className="stats">
        {[['Saved Jobs', counts?.saved], ['Applications', counts?.applications], ['Followed Exams', counts?.followed], ['Upcoming Alerts', counts?.upcoming]].map(([label, n]) => (
          <div key={label} className="stat"><strong>{n ?? '–'}</strong><span>{label}</span></div>
        ))}
      </div>

      <div className="dash">
        <nav className="side-tabs" aria-label="Account sections">
          {TABS.map(([k, label]) => (
            <button key={k} className={k === tab ? 'on' : ''} onClick={() => setParams({ tab: k })}>{label}</button>
          ))}
        </nav>
        <div className="dash-main">
          {tab === 'saved' && (
            <div className="dash-split">
              <div>
                <h2 className="panel-title">Saved Jobs</h2>
                <SavedJobs kind="save" empty={{ title: 'No saved jobs yet', hint: 'Tap "Save Job" on any listing to keep it here.' }} />
              </div>
              <aside className="panel">
                <h2 className="panel-title">Upcoming Alerts</h2>
                {summary.loading ? <Loading /> : summary.data?.upcoming.length ? (
                  <ul className="rows compact">
                    {summary.data.upcoming.map((u) => (
                      <li key={`${u.slug}-${u.label}`}>
                        <div><Link to={`/jobs/${u.slug}`}>{u.title}</Link><div className="muted small">{u.label}</div></div>
                        <span className="small">{formatDate(u.date)}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="muted small">Save or follow exams to see their key dates here.</p>}
              </aside>
            </div>
          )}
          {tab === 'applications' && <Applications />}
          {tab === 'followed' && <SavedJobs kind="follow" empty={{ title: 'Not following any exam', hint: 'Follow an exam from its page to get date and admit card alerts.' }} />}
          {tab === 'alerts' && <Alerts />}
          {tab === 'subscription' && <Subscription />}
          {tab === 'profile' && <Profile />}
        </div>
      </div>
    </div>
  );
}
