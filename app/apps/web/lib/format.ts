/** Map a status string to a badge style class. Shared across the monitor views. */
export function badgeClass(status: string | null): string {
  const s = (status ?? '').toLowerCase();
  if (['completed', 'done', 'ok', 'answered'].includes(s)) return 'badge ok';
  if (['running', 'review', 'in-progress', 'planned', 'open', 'pending'].includes(s)) return 'badge warn';
  if (['failed', 'blocked', 'rejected', 'cancelled'].includes(s)) return 'badge bad';
  return 'badge';
}

/** Format a timestamp for display, or an em dash when absent. */
export function fmt(ts: string | null): string {
  return ts ? new Date(ts).toLocaleString() : '—';
}
