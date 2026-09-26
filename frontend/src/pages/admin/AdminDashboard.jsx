import { Link } from 'react-router-dom';
import { adminApi } from '../../api';
import { useFetch } from '../../utils/useFetch';
import { Loading, ErrorBox } from '../../components/common';
import { formatNumber } from '../../utils/format';

export default function AdminDashboard() {
  const { data, loading, error, reload } = useFetch(() => adminApi.stats(), []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const c = data.counts;
  const tiles = [
    ['Registered users', c.users], ['Total jobs', c.jobs], ['Open jobs', c.activeJobs],
    ['Government / Private', `${c.govJobs} / ${c.privateJobs}`], ['Apply clicks', c.applyClicks], ['Unique applicants', c.applicants],
    ['Revenue', `₹${formatNumber(c.revenue)}`], ['Paid orders', c.paidPayments],
  ];
  return (
    <div className="stack-lg">
      <div className="page-head"><h1>Dashboard</h1><Link className="btn btn-accent" to="/admin/jobs/new">+ Add job</Link></div>
      <div className="stats">
        {tiles.map(([label, n]) => <div className="stat" key={label}><strong>{typeof n === 'number' ? formatNumber(n) : n}</strong><span>{label}</span></div>)}
      </div>

      <section className="panel">
        <h2 className="panel-title">Jobs by category</h2>
        {data.byCategory.length === 0 ? <p className="muted">No jobs posted yet.</p> : (
          <div className="table-wrap">
            <table className="grid">
              <thead><tr><th>Category</th><th>Sector</th><th>Jobs posted</th><th>Apply clicks</th><th /></tr></thead>
              <tbody>
                {data.byCategory.map((r) => (
                  <tr key={`${r.category}-${r.sector}`}>
                    <td><strong>{r.category}</strong></td>
                    <td>{r.sector}</td>
                    <td>{formatNumber(r.jobs)}</td>
                    <td>{formatNumber(r.applyClicks)}</td>
                    <td><Link className="link-strong" to={`/admin/applications?category=${encodeURIComponent(r.category)}&sector=${r.sector}`}>Applicants →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="two-col">
        <section className="panel">
          <h2 className="panel-title">Latest applicants</h2>
          {data.recentApplicants.length === 0 ? <p className="muted">No one has clicked Apply yet.</p> : (
            <ul className="rows compact">
              {data.recentApplicants.map((a) => (
                <li key={a._id}>
                  <div><strong>{a.user?.name || 'Deleted user'}</strong><div className="muted small">{a.job?.title || 'Removed job'} · {a.job?.category}</div></div>
                  <span className="small">{new Date(a.lastClickedAt).toLocaleDateString('en-IN')}</span>
                </li>
              ))}
            </ul>
          )}
          <Link className="link-strong" to="/admin/applications">See all applicants →</Link>
        </section>
        <section className="panel">
          <h2 className="panel-title">Most applied jobs</h2>
          {data.topJobs.length === 0 ? <p className="muted">No jobs yet.</p> : (
            <ul className="rows compact">
              {data.topJobs.map((j) => (
                <li key={j._id}>
                  <div><Link to={`/jobs/${j.slug}`}>{j.title}</Link><div className="muted small">{j.category}</div></div>
                  <span className="small">{formatNumber(j.applyClickCount)} clicks · {formatNumber(j.viewCount)} views</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
