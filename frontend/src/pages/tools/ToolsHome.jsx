import { Link } from 'react-router-dom';
import { Loading, ErrorBox } from '../../components/common';
import { useTool } from '../../components/tools/toolContext';
import { TIER_LABEL } from '../../components/tools/ToolShell';
import Reveal from '../../components/Reveal';

const ROWS = [
  ['Daily uses', (l) => l.dailyOps],
  ['Video compressions / day', (l) => l.dailyVideo],
  ['Tries per minute', (l) => l.perMinute],
  ['Max image size', (l) => `${l.maxImageMb} MB`],
  ['Files at once', (l) => l.maxFiles],
  ['Max video size', (l) => `${l.maxVideoMb} MB`],
];

export default function ToolsHome() {
  const { cfg } = useTool();
  if (cfg.loading && !cfg.data) return <Loading />;
  if (cfg.error && !cfg.data) return <ErrorBox message={cfg.error} onRetry={cfg.reload} />;
  const { tools, limitsByTier, plan } = cfg.data;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Free Tools</h1>
          <p className="muted">Compress, resize and convert images, PDFs and videos for your job and exam forms. Free with a JobWallah account.</p>
        </div>
      </div>

      <div className="tool-grid">
        {tools.map((t, i) => (
          <Reveal key={t.id} delay={i * 50}>
            <Link to={`/tools/${t.id}`} className={`tool-tile tier-${t.tier}`}>
              <span className="tool-icon" aria-hidden="true">{t.icon}</span>
              <strong>{t.name}</strong>
              <span className="muted small">{t.description}</span>
              <span className="tool-tags">
                <span className={`badge ${t.tier === 'free' ? 'badge-active' : 'badge-official'}`}>{TIER_LABEL[t.tier]}</span>
                {t.runsIn === 'browser' && <span className="badge badge-new">Private · in browser</span>}
              </span>
            </Link>
          </Reveal>
        ))}
      </div>

      <section className="panel limits-panel">
        <h2 className="panel-title">Fair-use limits</h2>
        <p className="muted small">Limits reset every day at midnight IST. If a tool fails, that try is not counted.</p>
        <div className="table-wrap">
          <table className="grid compare">
            <thead><tr><th>Limit</th><th>Free{!plan || plan === 'free' ? ' (you)' : ''}</th><th>Pro{plan === 'pro' ? ' (you)' : ''}</th><th>Annual{plan === 'annual' ? ' (you)' : ''}</th></tr></thead>
            <tbody>
              {ROWS.map(([label, fn]) => (
                <tr key={label}><td>{label}</td><td>{fn(limitsByTier.free)}</td><td>{fn(limitsByTier.pro)}</td><td>{fn(limitsByTier.annual)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!plan || plan === 'free') && <p><Link className="btn btn-accent btn-sm" to="/pricing">Upgrade for higher limits</Link></p>}
      </section>
    </>
  );
}
