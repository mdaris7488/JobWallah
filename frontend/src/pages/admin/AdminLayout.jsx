import { NavLink, Outlet } from 'react-router-dom';

const LINKS = [
  ['/admin', 'Dashboard', true],
  ['/admin/jobs', 'Jobs'],
  ['/admin/applications', 'Applications'],
  ['/admin/updates', 'Admit Cards & Results'],
  ['/admin/payments', 'Payments'],
  ['/admin/users', 'Users'],
];

export default function AdminLayout() {
  return (
    <div className="container page admin">
      <aside className="admin-side">
        <h2>Admin</h2>
        <nav aria-label="Admin">
          {LINKS.map(([to, label, end]) => <NavLink key={to} to={to} end={end}>{label}</NavLink>)}
        </nav>
      </aside>
      <section className="admin-main"><Outlet /></section>
    </div>
  );
}
