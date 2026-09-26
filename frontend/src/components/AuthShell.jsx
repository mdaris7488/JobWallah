import { Link } from 'react-router-dom';

const PERKS = [['🔎', 'Verified government & private jobs'], ['🔔', 'Admit card & result alerts'], ['🛠', 'Free image, PDF & video tools']];

/** Split-screen layout shared by login / register / forgot password. */
export default function AuthShell({ title, sub, children, footer }) {
  return (
    <div className="auth-split">
      <aside className="auth-aside">
        <div className="hero-bg" aria-hidden="true"><span className="orb orb-1" /><span className="orb orb-2" /></div>
        <div className="auth-aside-in">
          <Link to="/" className="brand" style={{ color: '#fff' }}><span className="brand-mark">JW</span><span>JobWallah</span></Link>
          <h2>Your next job is one click away</h2>
          <p style={{ color: '#c6d4ee' }}>Join thousands of aspirants who track jobs, exams and deadlines in one place.</p>
          <ul className="perks">
            {PERKS.map(([icon, text]) => <li key={text}><span aria-hidden="true">{icon}</span>{text}</li>)}
          </ul>
        </div>
      </aside>
      <div className="auth-main">
        <div className="auth-card">
          <h1>{title}</h1>
          <p className="muted">{sub}</p>
          {children}
          <p className="auth-foot">{footer}</p>
        </div>
      </div>
    </div>
  );
}
