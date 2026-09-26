import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { jobsApi, meApi } from '../api';
import { getErrorMessage } from '../api/http';
import { useFetch } from '../utils/useFetch';
import { showToast } from '../store/uiSlice';
import { Loading, ErrorBox, StatusBadge } from '../components/common';
import ApplyButton from '../components/ApplyButton';
import { formatDate, formatNumber, safeUrl } from '../utils/format';

// Every section is optional: it is shown only when the admin filled it in.
const SECTIONS = [
  ['description', 'Job Description'],
  ['responsibilities', 'Role & Responsibilities'],
  ['requirements', 'Requirements & Skills'],
  ['vacancyDetails', 'Vacancy Details'],
  ['eligibility', 'Eligibility'],
  ['ageLimitDetails', 'Age Limit'],
  ['salaryDetails', 'Salary / Pay Scale'],
  ['benefits', 'Benefits & Perks'],
  ['selectionProcess', 'Selection Process'],
  ['howToApply', 'How to Apply'],
];

export default function JobDetails() {
  const { slug } = useParams();
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, loading, error, reload } = useFetch(() => jobsApi.get(slug), [slug, user?._id]);
  const [flags, setFlags] = useState({ saved: false, followed: false, appliedAt: null });

  useEffect(() => {
    setFlags(data?.userState || { saved: false, followed: false, appliedAt: null });
  }, [data]);

  if (loading) return <div className="container page"><Loading /></div>;
  if (error) return <div className="container page"><ErrorBox message={error} onRetry={reload} /><p><Link to="/jobs">← Back to Jobs</Link></p></div>;

  const { job } = data;
  const isGov = job.sector === 'government';

  const toggle = async (kind, flag) => {
    if (!user) return navigate('/login', { state: { from: location } });
    try {
      if (flags[flag]) await meApi.removeBookmark(job._id, kind); else await meApi.addBookmark(job._id, kind);
      setFlags((f) => ({ ...f, [flag]: !f[flag] }));
      dispatch(showToast({ type: 'success', message: flags[flag] ? 'Removed.' : kind === 'save' ? 'Job saved.' : 'You will get alerts for this exam.' }));
    } catch (err) {
      dispatch(showToast({ type: 'error', message: getErrorMessage(err) }));
    }
    return undefined;
  };

  const info = [
    ['Category', job.category],
    ['Sector', isGov ? 'Government' : 'Private'],
    ['Vacancies', job.vacancies ? formatNumber(job.vacancies) : null],
    ['Qualification', job.qualification],
    ['Age Limit', job.ageLimit],
    ['Experience', job.experience],
    ['Salary', job.salary],
    ['Job Location', job.location],
    ['State', job.state && job.state !== 'All India' ? job.state : null],
    ['Job Type', job.jobType],
    ['Work Mode', job.workMode],
    ['Application Fee', job.applicationFee],
    ['Last Date', job.lastDate ? formatDate(job.lastDate) : null],
    ['Exam Date', job.examDateText || (job.examDate ? formatDate(job.examDate) : null)],
  ].filter(([, v]) => v);

  const sections = SECTIONS.filter(([key]) => job[key]);
  const markApplied = () => setFlags((f) => ({ ...f, appliedAt: new Date().toISOString() }));

  return (
    <div className="container page">
      <p><Link to={isGov ? '/government-jobs' : '/private-jobs'}>← Back to Jobs</Link></p>

      <header className="job-head">
        <div>
          <h1>{job.title}</h1>
          <div className="job-org">
            <span>{job.organization}</span>
            {job.verified && <span className="badge badge-verified">✓ Verified</span>}
            {isGov && <span className="badge badge-official">Official Source</span>}
          </div>
          <div className="job-dates muted">
            <span>Posted: {formatDate(job.postedAt)}</span>
            {job.lastDate && <span>Last Date: {formatDate(job.lastDate)}</span>}
            <StatusBadge status={job.status} />
          </div>
        </div>
        <div className="job-actions">
          <ApplyButton job={job} label="Apply on Official Website" onTracked={markApplied} />
          <button className="btn btn-ghost" onClick={() => toggle('save', 'saved')}>{flags.saved ? '★ Saved' : '☆ Save Job'}</button>
          {isGov && <button className="btn btn-ghost" onClick={() => toggle('follow', 'followed')}>{flags.followed ? '🔔 Following' : '🔔 Follow exam'}</button>}
        </div>
      </header>

      <dl className="info-grid">
        {info.map(([k, v]) => (<div key={k} className="info"><dt>{k}</dt><dd>{v}</dd></div>))}
      </dl>

      <div className="detail-cols">
        <div>
          {sections.length === 0 && (
            <p className="muted">The company has not shared more details for this opening yet. Use the apply button to see the full listing on their website.</p>
          )}
          {sections.map(([key, label], i) => (
            <section key={key} className="dsec">
              <h2><span className="dsec-n">{i + 1}.</span> {label}</h2>
              <p className="prose">{job[key]}</p>
            </section>
          ))}
        </div>

        {job.importantLinks?.length > 0 && (
          <aside className="panel links-panel">
            <h2 className="panel-title">Important Links</h2>
            <ul className="link-rows">
              {job.importantLinks.map((l) => (
                <li key={`${l.label}-${l.url}`}>
                  <span>{l.label}</span>
                  <a className="btn btn-ghost btn-sm" href={safeUrl(l.url)} target="_blank" rel="noopener noreferrer nofollow">{l.buttonText || 'Open'}</a>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      <section className="apply-bar" aria-label="Apply">
        <div>
          <strong>Ready to apply?</strong>
          <div className="muted small">
            You will be taken to {job.organization}&apos;s official page.
            {flags.appliedAt && ` You last opened it on ${formatDate(flags.appliedAt)}.`}
          </div>
        </div>
        <ApplyButton job={job} label="Apply on Official Website" onTracked={markApplied} />
      </section>

      <p className="disclaimer">JobWallah is an independent platform — verify on the official source before applying.</p>
    </div>
  );
}
