import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { getErrorMessage } from '../api/http';
import { Field, OtpInput, PasswordInput } from '../components/common';
import AuthShell from '../components/AuthShell';

const COOLDOWN = 60;

/** Step 1: email  ->  Step 2: 6-digit code from email + new password  ->  Step 3: done */
export default function ForgotPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async (e) => {
    e?.preventDefault();
    setBusy(true); setError('');
    try {
      const { data } = await authApi.forgotPassword({ email: email.trim() });
      setInfo(data.message);
      setStep('code');
      setCooldown(COOLDOWN);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    setError('');
    if (code.length !== 6) return setError('Enter the 6-digit code from your email.');
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      await authApi.resetPassword({ email: email.trim(), code, newPassword: password });
      setStep('done');
      setTimeout(() => navigate('/login'), 3500);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  if (step === 'done') {
    return (
      <AuthShell title="Password updated" sub="You can now log in with your new password." footer={<Link to="/login">Go to login</Link>}>
        <div className="success-box"><div className="success-check" aria-hidden="true">✓</div><p className="muted">Taking you to the login page…</p></div>
      </AuthShell>
    );
  }

  if (step === 'code') {
    return (
      <AuthShell title="Check your email" sub={info}
        footer={<button type="button" className="btn btn-ghost btn-sm" onClick={() => { setStep('email'); setCode(''); setError(''); }}>Use a different email</button>}>
        <form className="form" onSubmit={reset}>
          <Field label={`6-digit code sent to ${email}`}><OtpInput value={code} onChange={setCode} /></Field>
          <Field label="New password" hint="At least 8 characters, with a letter and a number.">
            <PasswordInput required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm new password">
            <PasswordInput required minLength={8} maxLength={72} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="btn btn-accent btn-block" disabled={busy}>{busy ? 'Updating…' : 'Reset password'}</button>
          <button type="button" className="btn btn-ghost btn-block" disabled={busy || cooldown > 0} onClick={() => sendCode()}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" sub="Enter your email and we will send you a 6-digit code."
      footer={<>Remembered it? <Link to="/login">Back to login</Link></>}>
      <form className="form" onSubmit={sendCode}>
        <Field label="Email"><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn btn-accent btn-block" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
      </form>
    </AuthShell>
  );
}
