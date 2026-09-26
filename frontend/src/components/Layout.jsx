import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/authSlice';
import { clearToast } from '../store/uiSlice';
import { initials } from '../utils/format';

const NAV = [
  ['/government-jobs', 'Government Jobs'],
  ['/private-jobs', 'Private Jobs'],
  ['/states', 'State-wise'],
  ['/categories', 'Category-wise'],
  ['/updates/admit-card', 'Admit Card'],
  ['/updates/results', 'Results'],
  ['/tools', 'Free Tools'],
];

function Brand() {
  return (
    <Link to="/" className="brand" aria-label="JobWallah home">
      <span className="brand-mark">JW</span>
      <span className="brand-name">JobWallah</span>
    </Link>
  );
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="user-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
        <span className="user-name">{user.name.split(' ')[0]}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="user-pop" role="menu">
          <div className="user-pop-head"><strong>{user.name}</strong><span className="muted small">{user.email}</span></div>
          {user.role === 'admin' && <Link role="menuitem" to="/admin" onClick={close}>Admin panel</Link>}
          <Link role="menuitem" to="/dashboard" onClick={close}>My account</Link>
          <Link role="menuitem" to="/dashboard?tab=saved" onClick={close}>Saved jobs</Link>
          <Link role="menuitem" to="/tools" onClick={close}>Free tools</Link>
          <button type="button" role="menuitem" onClick={() => { close(); onLogout(); }}>Log out</button>
        </div>
      )}
    </div>
  );
}

function Navbar() {
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const onLogout = async () => { await dispatch(logout()); navigate('/'); };

  return (
    <header className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="container navbar-in">
        <Brand />
        <button className="icon-btn nav-toggle" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>☰</button>
        <nav className={`nav ${open ? 'nav-open' : ''}`} aria-label="Main">
          {NAV.map(([to, label]) => <NavLink key={to} to={to} className="nav-link">{label}</NavLink>)}
          <NavLink to="/pricing" className="nav-link nav-pro">Pro Alerts</NavLink>
          <div className="nav-auth">
            {user ? (
              <UserMenu user={user} onLogout={onLogout} />
            ) : (
              <>
                <Link className="btn btn-ghost btn-sm" to="/login">Login</Link>
                <Link className="btn btn-primary btn-sm" to="/register">Sign Up</Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Brand />
          <p className="footer-tag">Apni qualification, location aur interest ke according latest jobs easily find karein.</p>
        </div>
        <div>
          <h4>Explore</h4>
          <Link to="/government-jobs">Government Jobs</Link>
          <Link to="/private-jobs">Private Jobs</Link>
          <Link to="/states">State Jobs</Link>
          <Link to="/updates/results">Results</Link>
          <Link to="/tools">Free Tools</Link>
        </div>
        <div>
          <h4>Account</h4>
          <Link to="/dashboard?tab=alerts">Job Alerts</Link>
          <Link to="/pricing">Subscription</Link>
          <Link to="/dashboard">Dashboard</Link>
        </div>
        <div>
          <h4>Legal</h4>
          <Link to="/legal/privacy">Privacy Policy</Link>
          <Link to="/legal/terms">Terms</Link>
          <Link to="/legal/refund">Refund Policy</Link>
          <Link to="/legal/disclaimer">Disclaimer</Link>
        </div>
      </div>
      <div className="container footer-note">
        JobWallah is an independent employment information platform and is not a government website.
        Always verify recruitment information on the official source before applying.
        <div>© {new Date().getFullYear()} JobWallah. All rights reserved.</div>
      </div>
    </footer>
  );
}

function MobileNav() {
  const items = [['/', '🏠', 'Home'], ['/jobs', '📋', 'Jobs'], ['/dashboard?tab=saved', '⭐', 'Saved'], ['/dashboard?tab=alerts', '🔔', 'Alerts'], ['/dashboard?tab=profile', '👤', 'Profile']];
  return (
    <nav className="mobile-nav" aria-label="Quick navigation">
      {items.map(([to, icon, label]) => (
        <Link key={label} to={to}><span aria-hidden="true">{icon}</span>{label}</Link>
      ))}
    </nav>
  );
}

function Toaster() {
  const toast = useSelector((s) => s.ui.toast);
  const dispatch = useDispatch();
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => dispatch(clearToast()), 4500);
    return () => clearTimeout(t);
  }, [toast, dispatch]);
  if (!toast) return null;
  return <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">{toast.message}</div>;
}

export default function Layout() {
  const { user } = useSelector((s) => s.auth);
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="app">
      <div className="topbar">
        <div className="container topbar-in">
          <span><Link to="/jobs?status=active">Latest Updates</Link><Link to="/pricing">WhatsApp Alerts</Link></span>
          {!user && <Link to="/login">Login / Sign Up</Link>}
        </div>
      </div>
      <Navbar />
      <main className="main page-enter" key={pathname}><Outlet /></main>
      <Footer />
      <MobileNav />
      <Toaster />
    </div>
  );
}
