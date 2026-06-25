import { openQuestions } from '../../lib/queries';
import { requireOperator } from '../../lib/auth';
import { AnswerForm } from './answer-form';

export const dynamic = 'force-dynamic';

export default async function QuestionsPage() {
  await requireOperator();
  const questions = await openQuestions();

  return (
    <main>
      <h2>Open questions ({questions.length})</h2>
      <p className="empty" style={{ marginTop: 0 }}>
        Questions raised during scheduled cycles land here instead of blocking the run.
      </p>

      {questions.length === 0 ? (
        <p className="empty">Nothing waiting. Cycles are running clean.</p>
      ) : (
        questions.map((q) => (
          <div className="q" key={q.id}>
            <div className="meta">
              #{q.id} · cycle {q.cycle_id ?? '—'} · {q.persona_id ?? 'unknown'}
              {q.task_id ? ` · task ${q.task_id}` : ''}
              {q.blocking ? ' · ' : ''}
              {q.blocking ? <span className="badge bad">blocking</span> : null}
              {' · '}{new Date(q.created_at).toLocaleString()}
            </div>
            <div>{q.question}</div>
            {q.context ? <div className="meta" style={{ marginTop: 6 }}>context: {q.context}</div> : null}
            <AnswerForm id={q.id} />
          </div>
        ))
      )}
    </main>
  );
}
