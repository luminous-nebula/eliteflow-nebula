'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AnswerForm({ id }: { id: number }) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    setBusy(true);
    await fetch(`/api/questions/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answer }),
    });
    setBusy(false);
    setAnswer('');
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <input
        type="text"
        placeholder="Answer / decision…"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={busy}
      />
      <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Resolve'}</button>
    </form>
  );
}
