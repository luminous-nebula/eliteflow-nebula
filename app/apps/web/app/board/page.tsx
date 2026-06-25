import { taskBoard } from '../../lib/queries';
import { requireOperator } from '../../lib/auth';
import { badgeClass } from '../../lib/format';

export const dynamic = 'force-dynamic';

export default async function BoardPage() {
  await requireOperator();
  const board = await taskBoard();

  return (
    <main>
      <h2>Task board ({board.length})</h2>
      <p className="empty" style={{ marginTop: 0 }}>
        Every tracked task with its latest dispatch. The orchestrator works automatable
        (<code>auto</code>) tasks; the rest are planned but not yet picked up by a cycle.
      </p>

      {board.length === 0 ? (
        <p className="empty">No tasks seeded yet.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Task</th><th>Name</th><th>Status</th><th>Auto</th><th>Assignee</th><th>Dispatch</th><th>Cycle</th></tr>
          </thead>
          <tbody>
            {board.map((t) => (
              <tr key={t.task_id}>
                <td>{t.task_id}</td>
                <td>{t.task_name}</td>
                <td><span className={badgeClass(t.task_status)}>{t.task_status ?? 'unset'}</span></td>
                <td>{t.auto ? '✓' : '—'}</td>
                <td>{t.assignee_persona_id ?? '—'}</td>
                <td>{t.dispatch_status ? <span className={badgeClass(t.dispatch_status)}>{t.dispatch_status}</span> : '—'}</td>
                <td>{t.cycle_no ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
