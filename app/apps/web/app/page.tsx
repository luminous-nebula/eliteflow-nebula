import {
  recentCycles, taskStatusCounts, openQuestionCount, runningCycleCount, recentRuns, costTotals,
} from '../lib/queries';
import { requireOperator } from '../lib/auth';
import { badgeClass, fmt } from '../lib/format';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  await requireOperator();

  const [cycles, statusCounts, openQ, runningC, runs, cost] = await Promise.all([
    recentCycles(8), taskStatusCounts(), openQuestionCount(), runningCycleCount(), recentRuns(12), costTotals(),
  ]);
  const totalTasks = statusCounts.reduce((s, r) => s + r.count, 0);

  return (
    <main>
      <section className="cards">
        <div className="card"><div className="n">{runningC}</div><div className="l">Running cycles</div></div>
        <div className="card"><div className="n">{openQ}</div><div className="l"><a href="/questions">Open questions</a></div></div>
        <div className="card"><div className="n">{totalTasks}</div><div className="l">Tasks tracked</div></div>
        <div className="card"><div className="n">${cost.cost_usd.toFixed(2)}</div><div className="l">Total spend · {cost.run_count} runs</div></div>
      </section>

      <h2>Tasks by status</h2>
      {statusCounts.length === 0 ? <p className="empty">No tasks seeded yet.</p> : (
        <table>
          <thead><tr><th>Status</th><th>Count</th></tr></thead>
          <tbody>
            {statusCounts.map((r) => (
              <tr key={r.status}><td><span className={badgeClass(r.status)}>{r.status}</span></td><td>{r.count}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Recent work-cycles</h2>
      {cycles.length === 0 ? <p className="empty">No cycles run yet. Trigger one with <code>npm run run-cycle</code>.</p> : (
        <table>
          <thead><tr><th>#</th><th>Trigger</th><th>Status</th><th>Runs</th><th>Started</th><th>Ended</th></tr></thead>
          <tbody>
            {cycles.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.trigger}</td>
                <td><span className={badgeClass(c.status)}>{c.status}</span></td>
                <td>{c.run_count}</td>
                <td>{fmt(c.started_at)}</td>
                <td>{fmt(c.ended_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Recent runs</h2>
      {runs.length === 0 ? <p className="empty">No runs yet.</p> : (
        <table>
          <thead><tr><th>Run</th><th>Cycle</th><th>Persona</th><th>Task</th><th>Status</th><th>Summary</th></tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.cycle_id}</td>
                <td>{r.persona_id}</td>
                <td>{r.task_id ?? '—'}</td>
                <td><span className={badgeClass(r.status)}>{r.status}</span></td>
                <td>{r.summary ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
