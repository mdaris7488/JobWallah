import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { adminApi } from '../../api';
import { getErrorMessage } from '../../api/http';
import { useFetch } from '../../utils/useFetch';
import { showToast } from '../../store/uiSlice';
import { Loading, ErrorBox, Field, Select } from '../../components/common';
import { CATEGORIES, JOB_TYPES, STATES, WORK_MODES } from '../../utils/constants';
import { toDateInput } from '../../utils/format';

const TEXT_SECTIONS = [
  ['description', 'Job description'],
  ['responsibilities', 'Role & responsibilities'],
  ['requirements', 'Requirements & skills'],
  ['vacancyDetails', 'Vacancy details'],
  ['eligibility', 'Eligibility'],
  ['ageLimitDetails', 'Age limit details'],
  ['salaryDetails', 'Salary / pay scale details'],
  ['benefits', 'Benefits & perks'],
  ['selectionProcess', 'Selection process'],
  ['howToApply', 'How to apply'],
];

const EMPTY = {
  title: '', organization: '', sector: 'government', category: 'Sarkari Naukri', applyUrl: '',
  vacancies: 0, qualification: '', location: '', state: 'All India', jobType: 'Full Time', workMode: '', experience: '',
  salary: '', ageLimit: '', applicationFee: '', lastDate: '', examDate: '', examDateText: '',
  ...Object.fromEntries(TEXT_SECTIONS.map(([k]) => [k, ''])),
  importantLinks: [], verified: false, isPublished: true,
};

const fromJob = (job) => ({
  ...EMPTY,
  ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, job[k] ?? EMPTY[k]])),
  lastDate: toDateInput(job.lastDate),
  examDate: toDateInput(job.examDate),
  importantLinks: (job.importantLinks || []).map((l) => ({ label: l.label, url: l.url, buttonText: l.buttonText || '' })),
});

function JobForm({ initial, jobId }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isPrivate = f.sector === 'private';
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const on = (k) => (e) => set(k)(e.target.value);

  const setLink = (i, key, val) => setF((p) => ({ ...p, importantLinks: p.importantLinks.map((l, idx) => (idx === i ? { ...l, [key]: val } : l)) }));
  const addLink = () => setF((p) => ({ ...p, importantLinks: [...p.importantLinks, { label: '', url: '', buttonText: '' }] }));
  const removeLink = (i) => setF((p) => ({ ...p, importantLinks: p.importantLinks.filter((_, idx) => idx !== i) }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const payload = {
      ...f,
      applyUrl: f.applyUrl.trim(),
      vacancies: Number(f.vacancies || 0),
      lastDate: f.lastDate || null, // blank = no deadline
      examDate: f.examDate || null,
      workMode: f.workMode || undefined,
      importantLinks: f.importantLinks.filter((l) => l.label.trim() && l.url.trim())
        .map((l) => ({ label: l.label.trim(), url: l.url.trim(), buttonText: l.buttonText.trim() || undefined })),
    };
    try {
      if (jobId) await adminApi.updateJob(jobId, payload); else await adminApi.createJob(payload);
      dispatch(showToast({ type: 'success', message: jobId ? 'Job updated.' : 'Job created.' }));
      navigate('/admin/jobs');
    } catch (err) {
      setError(getErrorMessage(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack-lg" onSubmit={submit}>
      <div className="page-head">
        <div>
          <h1>{jobId ? 'Edit job' : 'Add job'}</h1>
          <p className="muted">Only title, company, sector, category and apply link are required. Anything you leave blank is simply hidden from users.</p>
        </div>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}

      <fieldset className="panel form-grid">
        <legend>Required</legend>
        <Field label="Job title *"><input required minLength={3} maxLength={200} value={f.title} onChange={on('title')} /></Field>
        <Field label="Company / department *"><input required minLength={2} maxLength={150} value={f.organization} onChange={on('organization')} /></Field>
        <Field label="Sector *"><Select value={f.sector} onChange={set('sector')} options={[{ value: 'government', label: 'Government' }, { value: 'private', label: 'Private' }]} /></Field>
        <Field label="Category * (where this job is listed)"><Select value={f.category} onChange={set('category')} options={CATEGORIES} /></Field>
        <Field label="Apply link * (company's official website / careers page)" hint="Users are sent here when they click Apply.">
          <input type="url" required maxLength={500} value={f.applyUrl} onChange={on('applyUrl')} placeholder="https://company.com/careers/job-123" />
        </Field>
      </fieldset>

      <fieldset className="panel form-grid">
        <legend>Job facts (optional)</legend>
        <Field label="State"><Select value={f.state} onChange={set('state')} options={STATES} /></Field>
        <Field label="Location (city / region)"><input maxLength={120} value={f.location} onChange={on('location')} /></Field>
        <Field label="Qualification"><input maxLength={120} value={f.qualification} onChange={on('qualification')} placeholder="Graduate, 12th Pass, B.Sc Nursing…" /></Field>
        <Field label="Job type"><Select value={f.jobType} onChange={set('jobType')} options={JOB_TYPES} /></Field>
        <Field label="Vacancies / openings"><input type="number" min="0" max="10000000" value={f.vacancies} onChange={on('vacancies')} /></Field>
        <Field label="Salary / pay"><input maxLength={80} value={f.salary} onChange={on('salary')} placeholder={isPrivate ? '₹3.5-5 LPA' : '₹25,500-81,100'} /></Field>
        <Field label="Experience"><input maxLength={40} value={f.experience} onChange={on('experience')} placeholder="0-2 Yrs" /></Field>
        <Field label="Work mode"><Select value={f.workMode} onChange={set('workMode')} options={WORK_MODES} placeholder="Not specified" /></Field>
        <Field label="Age limit"><input maxLength={60} value={f.ageLimit} onChange={on('ageLimit')} placeholder="18-32 Years" /></Field>
        <Field label="Application fee"><input maxLength={80} value={f.applicationFee} onChange={on('applicationFee')} placeholder="₹100 / Nil" /></Field>
        <Field label="Last date to apply" hint="Leave blank if there is no deadline."><input type="date" value={f.lastDate} onChange={on('lastDate')} /></Field>
        <Field label="Exam date (used for alerts)"><input type="date" value={f.examDate} onChange={on('examDate')} /></Field>
        <Field label="Exam date (display text)"><input maxLength={60} value={f.examDateText} onChange={on('examDateText')} placeholder="14-24 Dec 2026" /></Field>
      </fieldset>

      <fieldset className="panel form">
        <legend>Details (optional, plain text — line breaks are kept)</legend>
        {TEXT_SECTIONS.map(([k, label]) => (
          <Field key={k} label={label}><textarea rows={4} maxLength={5000} value={f[k]} onChange={on(k)} /></Field>
        ))}
      </fieldset>

      <fieldset className="panel form">
        <legend>Important links (optional)</legend>
        {f.importantLinks.map((l, i) => (
          <div className="link-edit" key={i}>
            <input placeholder="Label (Official Notification)" maxLength={80} value={l.label} onChange={(e) => setLink(i, 'label', e.target.value)} aria-label="Link label" />
            <input type="url" placeholder="https://…" maxLength={500} value={l.url} onChange={(e) => setLink(i, 'url', e.target.value)} aria-label="Link URL" />
            <input placeholder="Button (View PDF)" maxLength={30} value={l.buttonText} onChange={(e) => setLink(i, 'buttonText', e.target.value)} aria-label="Button text" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeLink(i)}>Remove</button>
          </div>
        ))}
        {f.importantLinks.length < 10 && <button type="button" className="btn btn-ghost btn-sm" onClick={addLink}>+ Add link</button>}
      </fieldset>

      <fieldset className="panel form">
        <legend>Visibility</legend>
        <label className="check"><input type="checkbox" checked={f.verified} onChange={(e) => set('verified')(e.target.checked)} /> Mark as verified</label>
        <label className="check"><input type="checkbox" checked={f.isPublished} onChange={(e) => set('isPublished')(e.target.checked)} /> Published (visible to users)</label>
      </fieldset>

      <div className="row-end">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/admin/jobs')}>Cancel</button>
        <button className="btn btn-accent" disabled={busy}>{busy ? 'Saving…' : jobId ? 'Save changes' : 'Create job'}</button>
      </div>
    </form>
  );
}

export default function AdminJobForm() {
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(() => (id ? adminApi.job(id) : Promise.resolve({ data: { data: null } })), [id]);
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return <JobForm key={id || 'new'} initial={data ? fromJob(data.job) : EMPTY} jobId={id} />;
}
