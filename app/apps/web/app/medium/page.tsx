import { mediumThreads, threadMessages } from '../../lib/queries';
import { requireOperator } from '../../lib/auth';
import { fmt } from '../../lib/format';

export const dynamic = 'force-dynamic';

export default async function MediumPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  await requireOperator();
  const { t } = await searchParams;
  const threads = await mediumThreads(40);
  const activeId = t && threads.some((x) => x.id === t) ? t : (threads[0]?.id ?? null);
  const messages = activeId ? await threadMessages(activeId) : [];

  return (
    <main>
      <h2>Medium threads</h2>
      <p className="empty" style={{ marginTop: 0 }}>
        Read-only view of the founder ↔ persona conversations the gateway routed. Drive new
        ones from the steward CLI (<code>npm run medium</code>).
      </p>

      {threads.length === 0 ? (
        <p className="empty">No medium conversations yet.</p>
      ) : (
        <div className="medium">
          <aside className="thread-list">
            <ul>
              {threads.map((th) => (
                <li key={th.id} className={th.id === activeId ? 'active' : ''}>
                  <a href={`/medium?t=${th.id}`}>
                    <div className="t-title">{th.title || th.id.slice(0, 8)}</div>
                    <div className="t-meta">{th.messages} msgs · {th.last_persona_id ?? '—'}</div>
                  </a>
                </li>
              ))}
            </ul>
          </aside>

          <section className="thread">
            {messages.length === 0 ? (
              <p className="empty">Empty thread.</p>
            ) : (
              messages.map((m, i) => (
                <div className={`bubble ${m.role}`} key={i}>
                  <div className="who">
                    {m.role === 'user' ? 'Founder' : (m.persona_id ?? 'persona')} · {fmt(m.created_at)}
                  </div>
                  <div className="text">{m.content}</div>
                </div>
              ))
            )}
          </section>
        </div>
      )}
    </main>
  );
}
