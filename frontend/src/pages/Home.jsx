import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { jobsApi, updatesApi } from '../api';
import { useFetch } from '../utils/useFetch';
import { Loading, ErrorBox, Empty, Select, StatusBadge } from '../components/common';
import { GovJobsTable } from '../components/JobList';
import Reveal from '../components/Reveal';
import CountUp from '../components/CountUp';
import { HOME_CATEGORIES, HOME_STATES, QUALIFICATIONS, STATES } from '../utils/constants';
import { formatDate, formatNumber, safeUrl } from '../utils/format';

const TOOL_TEASERS = [
  ['image-compressor', '🗜', 'Compress image', 'Get it under 100 KB'],
  ['image-to-pdf', '🖼', 'Image to PDF', 'Many photos, one PDF'],
  ['pdf-to-image', '📄', 'PDF to image', 'Runs in your browser'],
  ['video-compressor', '🎬', 'Video compressor', 'Hit any size target'],
];

function UpdateList({ title, state, action }) {
  return (
    <section className="panel">
      <h2 className="panel-title">{title}</h2>
      {state.loading ? <Loading /> : state.error ? <ErrorBox message={state.error} onRetry={state.reload} /> : (
        state.data?.length ? (
          <ul className="update-list">
            {state.data.map((u) => (
              <li key={u._id}>
                <span>{u.title}</span>
                <a className="btn btn-ghost btn-sm" href={safeUrl(u.link)} target="_blank" rel="noopener noreferrer">{action}</a>
              </li>
            ))}
          </ul>
        ) : <Empty title="Nothing here yet" />
      )}
    </section>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [f, setF] = useState({ q: '', qualification: '', state: '', sector: '' });
  const stats = useFetch(() => jobsApi.stats(), []);
  const jobs = useFetch(() => jobsApi.list({ sector: 'government', limit: 5 }), []);
  const admit = useFetch(() => updatesApi.list({ type: 'admit_card', limit: 3 }), []);
  const results = useFetch(() => updatesApi.list({ type: 'result', limit: 3 }), []);

  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const submit = (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v.trim ? v.trim() : v));
    navigate(`/jobs?${p.toString()}`);
  };

  const catStat = (name) => stats.data?.categories.find((c) => c.category === name);
  const stateStat = (name) => stats.data?.states.find((s) => s.state === name);
  const sectorJobs = (sector) => stats.data?.sectors.find((s) => s.sector === sector)?.jobs || 0;
  const heroJobs = (jobs.data || []).slice(0, 3);
  const ticker = [...(admit.data || []), ...(results.data || [])];

  return (
    <>
      <section className="hero">
        <div className="hero-bg" aria-hidden="true"><span className="orb orb-1" /><span className="orb orb-2" /><span className="orb orb-3" /></div>
        <div className="container hero-grid">
          <div>
            <span className="eyebrow"><i className="pulse-dot" /> Verified jobs · Free tools · Instant alerts</span>
            <h1>Latest <span className="grad-text">Government &amp; Private Jobs</span> in India</h1>
            <p className="hero-sub">Verified job information, eligibility, important dates and direct application links — all in one place.</p>
            <form className="search" onSubmit={submit} role="search">
              <input
                type="search" value={f.q} onChange={(e) => set('q')(e.target.value)} maxLength={100}
                placeholder="Search jobs, exams, companies or departments" aria-label="Search jobs"
              />
              <button className="btn btn-accent" type="submit">Search</button>
            </form>
            <div className="search-filters">
              <Select value={f.qualification} onChange={set('qualification')} options={QUALIFICATIONS} placeholder="Qualification" aria-label="Qualification" />
              <Select value={f.state} onChange={set('state')} options={STATES} placeholder="State" aria-label="State" />
              <Select
                value={f.sector} onChange={set('sector')} placeholder="Job Type" aria-label="Job type"
                options={[{ value: 'government', label: 'Government' }, { value: 'private', label: 'Private' }]}
              />
            </div>
            <div className="hero-stats">
              <div className="hero-stat"><strong><CountUp value={sectorJobs('government')} /></strong><span>Government jobs</span></div>
              <div className="hero-stat"><strong><CountUp value={sectorJobs('private')} /></strong><span>Private jobs</span></div>
              <div className="hero-stat"><strong><CountUp value={6} /></strong><span>Free tools</span></div>
            </div>
          </div>

          <div className="hero-cards" aria-hidden={heroJobs.length === 0}>
            {heroJobs.map((j, i) => (
              <Link key={j._id} to={`/jobs/${j.slug}`} className={`float-card fc-${i + 1}`} tabIndex={-1}>
                <div className="fc-row"><strong>{j.title}</strong><StatusBadge status={j.status} /></div>
                <span className="muted">{j.organization}</span>
                <div className="fc-row">
                  <span className="small">{j.vacancies ? `${formatNumber(j.vacancies)} vacancies` : j.qualification || 'Apply now'}</span>
                  {j.lastDate && <span className="small muted">Last date {formatDate(j.lastDate)}</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {ticker.length > 0 && (
        <div className="ticker" aria-label="Latest updates">
          <div className="container ticker-in">
            <span className="ticker-label"><i className="pulse-dot" /> LIVE</span>
            <div className="ticker-track">
              <div className="ticker-move">
                {[...ticker, ...ticker].map((u, i) => <a key={`${u._id}-${i}`} href={safeUrl(u.link)} target="_blank" rel="noopener noreferrer" tabIndex={i >= ticker.length ? -1 : 0}>{u.title}</a>)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container page">
        <Reveal as="section">
          <div className="section-head">
            <h2>Browse by Category</h2>
            <Link to="/categories" className="link-strong">View All →</Link>
          </div>
          <div className="tiles">
            {HOME_CATEGORIES.map((c) => {
              const s = catStat(c.name);
              return (
                <Link key={c.name} className="tile" to={`/jobs?category=${encodeURIComponent(c.name)}`}>
                  <span className="tile-icon" aria-hidden="true">{c.icon}</span>
                  <strong>{c.name}</strong>
                  <span className="muted small">{formatNumber(s?.vacancies)} openings</span>
                </Link>
              );
            })}
          </div>
        </Reveal>

        <Reveal as="section">
          <div className="section-head">
            <h2>Latest Government Jobs</h2>
            <Link to="/government-jobs" className="link-strong">View All →</Link>
          </div>
          {jobs.loading ? <Loading /> : jobs.error ? <ErrorBox message={jobs.error} onRetry={jobs.reload} /> :
            jobs.data.length ? <GovJobsTable jobs={jobs.data} /> : <Empty title="No jobs published yet" hint="Check back soon." />}
        </Reveal>

        <Reveal as="section">
          <div className="section-head"><h2>Free tools for your forms</h2><Link to="/tools" className="link-strong">All tools →</Link></div>
          <div className="tiles tiles-4">
            {TOOL_TEASERS.map(([id, icon, name, hint]) => (
              <Link key={id} className="tile" to={`/tools/${id}`}>
                <span className="tile-icon" aria-hidden="true">{icon}</span>
                <strong>{name}</strong>
                <span className="muted small">{hint}</span>
              </Link>
            ))}
          </div>
        </Reveal>

        <Reveal as="section">
          <div className="section-head"><h2>Jobs by State</h2><Link to="/states" className="link-strong">All states →</Link></div>
          <div className="tiles tiles-4">
            {HOME_STATES.map((name) => (
              <Link key={name} className="tile tile-row" to={`/jobs?state=${encodeURIComponent(name)}`}>
                <strong>{name}</strong>
                <span className="count">{formatNumber(stateStat(name)?.jobs)}</span>
              </Link>
            ))}
          </div>
        </Reveal>

        <Reveal className="two-col">
          <UpdateList title="Latest Admit Cards" state={admit} action="Download" />
          <UpdateList title="Latest Results" state={results} action="Check" />
        </Reveal>
      </div>
    </>
  );
}
