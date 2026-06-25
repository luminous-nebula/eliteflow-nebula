import { personaActivity, recentEvents } from '../../lib/queries';
import { requireOperator } from '../../lib/auth';
import { fmt } from '../../lib/format';

export const dynamic = 'force-dynamic';

/** Group medium/engine events by a coarse kind for subtle styling. */
function eventBadge(type: string): string {
  if (type.startsWith('medium.')) return 'badge';
  if (type.endsWith('.fail') || type.endsWith('.skip')) return 'badge bad';
  if (type.endsWith('.done') || type.endsWith('.close')) return 'badge ok';
  return 'badge warn';
}

export default async function ActivityPage() {
  await requireOperator();
  const [personas, events] = await Promise.all([personaActivity(), recentEvents(60)]);

  return (
    <main>
      <h2>Per-persona activity</h2>
      {personas.length === 0 ? (
        <p className="empty">No persona runs yet.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Persona</th><th>Role</th><th>Runs</th><th>Done</th><th>Failed</th><th>Spend</th><th>Last active</th></tr>
          </thead>
          <tbody>
            {personas.map((p) => (
              <tr key={p.persona_id}>
                <td>{p.persona_name ?? p.persona_id}</td>
                <td>{p.role ?? '—'}</td>
                <td>{p.runs}</td>
                <td>{p.done}</td>
                <td>{p.failed > 0 ? <span className="badge bad">{p.failed}</span> : '0'}</td>
                <td>${p.cost_usd.toFixed(2)}</td>
                <td>{fmt(p.last_active)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Event timeline</h2>
      {events.length === 0 ? (
        <p className="empty">No events recorded yet.</p>
      ) : (
        <table>
          <thead><tr><th>When</th><th>Type</th><th>Cycle</th><th>Persona</th><th>Message</th></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{fmt(e.created_at)}</td>
                <td><span className={eventBadge(e.type)}>{e.type}</span></td>
                <td>{e.cycle_id ?? '—'}</td>
                <td>{e.persona_id ?? '—'}</td>
                <td>{e.message ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
