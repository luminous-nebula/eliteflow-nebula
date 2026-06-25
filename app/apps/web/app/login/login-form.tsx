'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm({ bootstrap }: { bootstrap: boolean }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? 'Sign-in failed.');
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <input
        type="password"
        placeholder={bootstrap ? 'Choose a password (min 8 chars)' : 'Password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        disabled={busy}
      />
      <button type="submit" disabled={busy}>{busy ? '…' : bootstrap ? 'Set password & continue' : 'Sign in'}</button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
