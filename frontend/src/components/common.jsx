import { useEffect, useRef, useState } from 'react';
import { STATUS_LABEL } from '../utils/constants';

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      <span /><span /><span />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="state-box state-error" role="alert">
      <p>{message}</p>
      {onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Empty({ title, hint, children }) {
  return (
    <div className="state-box">
      <strong>{title}</strong>
      {hint && <p className="muted">{hint}</p>}
      {children}
    </div>
  );
}

export function StatusBadge({ status }) {
  const cls = String(status).toLowerCase().replaceAll('_', '-');
  return <span className={`badge badge-${cls}`}>{STATUS_LABEL[status] || status}</span>;
}

export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pagination">
      <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
    </nav>
  );
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Select({ value, onChange, options, placeholder, ...rest }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

/** Password input with a show/hide button. */
export function PasswordInput({ value, onChange, ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-wrap">
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange} {...rest} />
      <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? '🙈' : '👁'}
      </button>
    </div>
  );
}

/** 6 separate boxes for a one-time code: auto-advance, backspace, paste support. */
export function OtpInput({ value, onChange, length = 6 }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');
  const setAt = (i, d) => {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join(''));
  };
  return (
    <div className="otp" role="group" aria-label="One-time code">
      {digits.map((d, i) => (
        <input
          key={i} ref={(el) => { refs.current[i] = el; }} value={d} inputMode="numeric" maxLength={1} pattern="[0-9]"
          autoComplete={i === 0 ? 'one-time-code' : 'off'} aria-label={`Digit ${i + 1}`}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(-1);
            setAt(i, v);
            if (v && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
            if (!text) return;
            e.preventDefault();
            onChange(text);
            refs.current[Math.min(text.length, length - 1)]?.focus();
          }}
        />
      ))}
    </div>
  );
}
