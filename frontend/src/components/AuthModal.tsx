'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Shown above the form, e.g. why they're being asked to sign in. */
  reason?: string;
  onAuthenticated?: () => void;
}

type Mode = 'login' | 'register';

const labelStyle: React.CSSProperties = {
  fontSize: '9px',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color: 'rgba(74,64,56,0.35)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(74,64,56,0.18)',
  padding: '8px 0',
  fontFamily: "var(--font-jost), sans-serif",
  fontSize: '14px',
  color: '#2a241f',
  outline: 'none',
};

export default function AuthModal({ isOpen, onClose, reason, onAuthenticated }: AuthModalProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  // Start clean each time it opens, so a previous failure isn't still on
  // screen when someone reopens it.
  useEffect(() => {
    if (isOpen) {
      setFieldErrors({});
      setFormError('');
      setPassword('');
      setBusy(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const switchMode = (next: Mode) => {
    setMode(next);
    setFieldErrors({});
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFieldErrors({});
    setFormError('');
    try {
      if (mode === 'register') await register({ name, email, password });
      else await login({ email, password });
      onAuthenticated?.();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fields ?? {});
        // Don't repeat the headline when every point is already shown inline.
        if (!err.fields || Object.keys(err.fields).length === 0) setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (key: string) =>
    fieldErrors[key] ? (
      <span style={{ fontSize: '10px', color: '#b3261e', letterSpacing: '0.04em' }}>
        {fieldErrors[key]}
      </span>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] relative"
        style={{
          background: '#f6f5f3',
          borderRadius: '18px',
          padding: '38px 34px 32px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute cursor-pointer"
          style={{
            top: '16px', right: '18px', background: 'none', border: 'none',
            fontSize: '18px', lineHeight: 1, color: 'rgba(74,64,56,0.4)',
          }}
        >
          ×
        </button>

        <div className="flex flex-col gap-1.5 mb-7">
          <span style={{ ...labelStyle, letterSpacing: '0.22em', color: 'var(--gold, #b3925e)' }}>
            StellaLens
          </span>
          <h2
            style={{
              fontFamily: "var(--font-cormorant), serif",
              fontSize: '28px', fontWeight: 400, color: '#2a241f', lineHeight: 1.2,
            }}
          >
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          {reason && (
            <p
              style={{
                fontFamily: "var(--font-jost), sans-serif",
                fontSize: '12px', color: 'rgba(74,64,56,0.6)', marginTop: '4px', lineHeight: 1.6,
              }}
            >
              {reason}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {mode === 'register' && (
            <div className="flex flex-col gap-1.5">
              <label style={labelStyle} htmlFor="auth-name">Name</label>
              <input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                required
                style={inputStyle}
              />
              {fieldError('name')}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label style={labelStyle} htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              style={inputStyle}
            />
            {fieldError('email')}
          </div>

          <div className="flex flex-col gap-1.5">
            <label style={labelStyle} htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              required
              style={inputStyle}
            />
            {fieldError('password')}
          </div>

          {formError && (
            <span style={{ fontSize: '11px', color: '#b3261e', letterSpacing: '0.04em' }}>
              {formError}
            </span>
          )}

          <button
            type="submit"
            disabled={busy}
            className="cursor-pointer"
            style={{
              marginTop: '6px',
              background: 'var(--gold, #b3925e)', color: '#fff', border: 'none',
              borderRadius: '999px', padding: '14px 20px',
              fontFamily: "var(--font-jost), sans-serif",
              fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div
          className="mt-6 text-center"
          style={{ fontFamily: "var(--font-jost), sans-serif", fontSize: '11px', color: 'rgba(74,64,56,0.55)' }}
        >
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            className="cursor-pointer"
            style={{
              background: 'none', border: 'none', padding: 0,
              color: 'var(--gold, #b3925e)', textDecoration: 'underline',
              fontFamily: 'inherit', fontSize: 'inherit',
            }}
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
