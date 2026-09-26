import { Link } from 'react-router-dom';
import { StatusBadge } from './common';
import ApplyButton from './ApplyButton';
import { formatDate, formatNumber, initials, timeAgo } from '../utils/format';

/** Desktop: dense table (like the notice boards aspirants are used to). Mobile: compact cards. */
export function GovJobsTable({ jobs }) {
  return (
    <>
      <div className="table-wrap only-desktop">
        <table className="grid">
          <thead>
            <tr>
              <th>Job / Department</th><th>Vacancies</th><th>Qualification</th><th>Location</th>
              <th>Last Date</th><th>Status</th><th><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j._id}>
                <td>
                  <Link className="job-title" to={`/jobs/${j.slug}`}>{j.title}</Link>
                  <div className="muted small">{j.organization}</div>
                </td>
                <td>{j.vacancies ? formatNumber(j.vacancies) : '-'}</td>
                <td>{j.qualification || '-'}</td>
                <td>{j.location || '-'}</td>
                <td>{j.lastDate ? formatDate(j.lastDate) : 'Not specified'}</td>
                <td><StatusBadge status={j.status} /></td>
                <td><Link className="link-strong" to={`/jobs/${j.slug}`}>View →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="only-mobile stack">
        {jobs.map((j) => (
          <Link key={j._id} to={`/jobs/${j.slug}`} className="mcard">
            <div className="mcard-top">
              <strong>{j.title}</strong>
              <StatusBadge status={j.status} />
            </div>
            <div className="muted small">{j.organization}</div>
            <div className="mcard-meta">
              {j.vacancies ? <span>{formatNumber(j.vacancies)} Vacancies</span> : null}
              {j.lastDate && <span>Last Date: {formatDate(j.lastDate)}</span>}
            </div>
            <span className="link-strong">View →</span>
          </Link>
        ))}
      </div>
    </>
  );
}

export function PrivateJobCard({ job }) {
  return (
    <article className="pcard">
      <div className="pcard-logo" aria-hidden="true">{initials(job.organization)}</div>
      <div className="pcard-body">
        <div className="pcard-head">
          <Link className="job-title" to={`/jobs/${job.slug}`}>{job.title}</Link>
          {job.verified && <span className="badge badge-verified">✓ Verified</span>}
          {job.status === 'EXPIRED' && <StatusBadge status="EXPIRED" />}
        </div>
        <div className="muted">{job.organization}</div>
        <div className="chips">
          {job.location && <span className="chip">{job.location}</span>}
          {job.experience && <span className="chip">{job.experience}</span>}
          {job.workMode && <span className="chip">{job.workMode}</span>}
        </div>
      </div>
      <div className="pcard-side">
        {job.salary && <strong>{job.salary}</strong>}
        <span className="muted small">{timeAgo(job.postedAt)}</span>
        <div className="row-actions">
          <Link className="btn btn-ghost btn-sm" to={`/jobs/${job.slug}`}>View details</Link>
          <ApplyButton job={job} className="btn btn-primary btn-sm" label="Apply Now" />
        </div>
      </div>
    </article>
  );
}
