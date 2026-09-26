import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { jobsApi } from '../api';
import { showToast } from '../store/uiSlice';
import { safeUrl } from '../utils/format';

/**
 * "Apply" = open the company's official application page in a new tab.
 * It is a real <a href> (so browsers never block it as a popup) and, for logged-in users, records the click
 * in the background so the admin can see who applied. Guests are asked to log in first.
 */
export default function ApplyButton({ job, className = 'btn btn-accent', label = 'Apply Now', onTracked }) {
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  if (job.status === 'EXPIRED') return <button type="button" className={className} disabled>Applications closed</button>;

  const onClick = (e) => {
    if (!user) {
      e.preventDefault();
      dispatch(showToast({ type: 'info', message: 'Please log in to apply. It takes a few seconds.' }));
      navigate('/login', { state: { from: location } });
      return;
    }
    jobsApi.applyClick(job._id).then(() => onTracked?.()).catch(() => { /* tracking must never block applying */ });
  };

  return (
    <a className={className} href={safeUrl(job.applyUrl)} target="_blank" rel="noopener noreferrer" onClick={onClick}>
      {label}
    </a>
  );
}
