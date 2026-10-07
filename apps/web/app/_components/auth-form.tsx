"use client";

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Mode = 'login' | 'register';

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const body = mode === 'register'
      ? {
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
          givenName: String(form.get('givenName') ?? ''),
          familyName: String(form.get('familyName') ?? ''),
        }
      : {
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
        };

    try {
      const api = process.env.NEXT_PUBLIC_API_URL;
      if (!api) throw new Error('TwiPay API is not configured.');
      const response = await fetch(`${api}/v1/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(response.status === 401 ? 'Unable to sign in with those credentials.' : 'Unable to complete this request.');
        return;
      }
      // Authentication is in an HttpOnly cookie. Do not persist access/session tokens in browser storage.
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Unable to reach TwiPay securely. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="form" noValidate>
    {mode === 'register' && <div className="form-row"><label>First name<input name="givenName" autoComplete="given-name" maxLength={100} /></label><label>Last name<input name="familyName" autoComplete="family-name" maxLength={100} /></label></div>}
    <label>Email<input name="email" type="email" autoComplete="email" required maxLength={320} /></label>
    <label>Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={12} maxLength={128} /></label>
    {error && <p role="alert" className="error">{error}</p>}
    <button className="button primary" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
  </form>;
}
