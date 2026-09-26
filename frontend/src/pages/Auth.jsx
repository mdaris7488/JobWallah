import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { clearAuthError, login, register } from '../store/authSlice';
import { Field, PasswordInput } from '../components/common';
import AuthShell from '../components/AuthShell';

function useAuthRedirect() {
  const { user, ready } = useSelector((s) => s.auth);
  const location = useLocation();
  if (ready && user) {
    const from = location.state?.from;
    const dest = from ? `${from.pathname}${from.search || ''}` : user.role === 'admin' ? '/admin' : '/dashboard';
    return <Navigate to={dest} replace />;
  }
  return null;
}

export function Login() {
  const dispatch = useDispatch();
  const { busy, error } = useSelector((s) => s.auth);
  const [form, setForm] = useState({ email: '', password: '' });
  useEffect(() => () => { dispatch(clearAuthError()); }, [dispatch]);
  const redirect = useAuthRedirect();
  if (redirect) return redirect;

  return (
    <AuthShell title="Welcome back" sub="Log in to save jobs, track exams and use the free tools."
      footer={<>New to JobWallah? <Link to="/register">Create an account</Link></>}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); dispatch(login(form)); }}>
        <Field label="Email"><input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password"><PasswordInput required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <div className="auth-link"><Link to="/forgot-password" state={{ email: form.email }}>Forgot password?</Link></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn btn-accent btn-block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const dispatch = useDispatch();
  const { busy, error } = useSelector((s) => s.auth);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [localError, setLocalError] = useState('');
  useEffect(() => () => { dispatch(clearAuthError()); }, [dispatch]);
  const redirect = useAuthRedirect();
  if (redirect) return redirect;

  const submit = (e) => {
    e.preventDefault();
    setLocalError('');
    const digits = form.phone.replace(/[\s\-().]/g, '');
    if (!/^(\+91|91|0)?[6-9]\d{9}$/.test(digits) && !/^\+[1-9]\d{7,14}$/.test(digits)) {
      setLocalError('Enter a valid 10-digit mobile number, e.g. 98765 43210.');
      return;
    }
    dispatch(register({ ...form, phone: form.phone.trim() }));
  };

  return (
    <AuthShell title="Create your account" sub="Free to join. Upgrade only if you want automatic alerts."
      footer={<>Already registered? <Link to="/login">Log in</Link></>}>
      <form className="form" onSubmit={submit}>
        <Field label="Full name"><input required minLength={2} maxLength={80} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Email"><input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Mobile number" hint="Required. Used for exam alerts and account help. Outside India? Start with +country code.">
          <input type="tel" inputMode="tel" required autoComplete="tel" placeholder="98765 43210" maxLength={20} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Password" hint="At least 8 characters, with a letter and a number.">
          <PasswordInput required minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        {(localError || error) && <div className="form-error" role="alert">{localError || error}</div>}
        <button className="btn btn-accent btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}
