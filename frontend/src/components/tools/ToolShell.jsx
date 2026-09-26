import { Link } from 'react-router-dom';
import { Loading, ErrorBox } from '../common';
import { useTool } from './toolContext';

const TIER_RANK = { free: 0, pro: 1, annual: 2 };
export const TIER_LABEL = { free: 'Free', pro: 'Pro', annual: 'Annual Pass' };

export function UsageBar({ config }) {
  const { limits, usage, plan } = config;
  return (
    <div className="usage">
      <span className={`badge ${plan && plan !== 'free' ? 'badge-active' : 'badge-new'}`}>{plan ? `${TIER_LABEL[plan]} plan` : 'Free plan'}</span>
      {usage && <span><strong>{usage.total}</strong>/{limits.dailyOps} uses today</span>}
      {usage && <span>Video: <strong>{usage.video}</strong>/{limits.dailyVideo}</span>}
      <span>{limits.perMinute} tries per minute</span>
      <span>Files up to {limits.maxImageMb} MB{limits.maxFiles > 1 ? `, ${limits.maxFiles} at once` : ''}</span>
      {(!plan || plan === 'free') && <Link to="/pricing" className="link-strong">Get higher limits</Link>}
    </div>
  );
}

/** Common frame of every tool page: title, plan/usage line, login + upgrade gates. */
export default function ToolShell({ tool, children }) {
  const { cfg, user } = useTool();
  if (cfg.loading && !cfg.data) return <Loading />;
  if (cfg.error && !cfg.data) return <ErrorBox message={cfg.error} onRetry={cfg.reload} />;

  const plan = cfg.data.plan || 'free';
  const needsLogin = tool.runsIn === 'server' && !user;
  const locked = TIER_RANK[plan] < TIER_RANK[tool.tier];
  const videoOff = tool.id === 'video-compressor' && !cfg.data.videoAvailable;

  return (
    <>
      <header className="tool-head">
        <h1><span aria-hidden="true">{tool.icon}</span> {tool.name}</h1>
        <p className="muted">{tool.description}</p>
        <span className={`badge ${tool.tier === 'free' ? 'badge-active' : 'badge-official'}`}>{TIER_LABEL[tool.tier]}{tool.runsIn === 'browser' ? ' · runs in your browser' : ''}</span>
      </header>
      {tool.runsIn === 'server' && <UsageBar config={cfg.data} />}

      <div className="panel tool-card">
        {needsLogin ? (
          <div className="state-box">
            <strong>Log in to use this free tool</strong>
            <p className="muted">A free account keeps the tools fair for everyone and saves your daily limits.</p>
            <Link className="btn btn-primary" to="/login" state={{ from: { pathname: `/tools/${tool.id}` } }}>Log in</Link>
            <Link to="/register">Create a free account</Link>
          </div>
        ) : locked ? (
          <div className="state-box">
            <strong>{tool.tier === 'annual' ? 'Included in the Annual Aspirant Pass' : 'Included in the Pro plans'}</strong>
            <p className="muted">Upgrade to use {tool.name} along with higher daily limits.</p>
            <Link className="btn btn-accent" to="/pricing">See plans</Link>
          </div>
        ) : videoOff ? (
          <div className="state-box"><strong>Video compression is not available on this server yet.</strong><p className="muted">Ask the site admin to install the ffmpeg-static package.</p></div>
        ) : children}
      </div>
    </>
  );
}
