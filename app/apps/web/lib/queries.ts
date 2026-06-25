import { query } from '@eliteflow/db';

export interface CycleSummary {
  id: number;
  trigger: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  run_count: number;
}

export async function recentCycles(limit = 10): Promise<CycleSummary[]> {
  const { rows } = await query<CycleSummary>(
    `SELECT c.id, c.trigger, c.status, c.started_at, c.ended_at,
            (SELECT count(*)::int FROM task_runs r WHERE r.cycle_id = c.id) AS run_count
       FROM work_cycles c
      ORDER BY c.id DESC
      LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function taskStatusCounts(): Promise<Array<{ status: string; count: number }>> {
  const { rows } = await query<{ status: string; count: number }>(
    `SELECT COALESCE(status, 'unset') AS status, count(*)::int AS count
       FROM tasks GROUP BY status ORDER BY count DESC`,
  );
  return rows;
}

export async function openQuestionCount(): Promise<number> {
  const { rows } = await query<{ count: number }>(
    `SELECT count(*)::int AS count FROM questions WHERE status = 'open'`,
  );
  return rows[0]?.count ?? 0;
}

export async function runningCycleCount(): Promise<number> {
  const { rows } = await query<{ count: number }>(
    `SELECT count(*)::int AS count FROM work_cycles WHERE status = 'running'`,
  );
  return rows[0]?.count ?? 0;
}

export interface QuestionRow {
  id: number;
  cycle_id: number | null;
  persona_id: string | null;
  task_id: string | null;
  question: string;
  context: string | null;
  blocking: boolean;
  status: string;
  answer: string | null;
  created_at: string;
}

export async function openQuestions(): Promise<QuestionRow[]> {
  const { rows } = await query<QuestionRow>(
    `SELECT id, cycle_id, persona_id, task_id, question, context, blocking, status, answer, created_at
       FROM questions WHERE status = 'open' ORDER BY created_at DESC`,
  );
  return rows;
}

export interface RunRow {
  id: number;
  cycle_id: number;
  persona_id: string;
  role: string | null;
  task_id: string | null;
  status: string;
  summary: string | null;
  started_at: string;
}

export async function recentRuns(limit = 15): Promise<RunRow[]> {
  const { rows } = await query<RunRow>(
    `SELECT id, cycle_id, persona_id, role, task_id, status, summary, started_at
       FROM task_runs ORDER BY id DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

// ── Monitor-only dashboard (Phase 2 / ADR-0002 D3) ──────────────────────────

export interface CostTotals {
  cost_usd: number;
  tokens_input: number;
  tokens_output: number;
  run_count: number;
}

/** Aggregate token/cost spend across all persona runs. */
export async function costTotals(): Promise<CostTotals> {
  const { rows } = await query<CostTotals>(
    `SELECT COALESCE(SUM(cost_usd), 0)::float       AS cost_usd,
            COALESCE(SUM(tokens_input), 0)::int     AS tokens_input,
            COALESCE(SUM(tokens_output), 0)::int    AS tokens_output,
            count(*)::int                           AS run_count
       FROM task_runs`,
  );
  return rows[0] ?? { cost_usd: 0, tokens_input: 0, tokens_output: 0, run_count: 0 };
}

export interface PersonaActivityRow {
  persona_id: string;
  persona_name: string | null;
  role: string | null;
  runs: number;
  done: number;
  failed: number;
  cost_usd: number;
  last_active: string | null;
}

/** Per-persona run activity and spend, for the activity view. */
export async function personaActivity(): Promise<PersonaActivityRow[]> {
  const { rows } = await query<PersonaActivityRow>(
    `SELECT r.persona_id,
            p.persona_name,
            ro.role,
            count(*)::int                                              AS runs,
            count(*) FILTER (WHERE r.status = 'done')::int             AS done,
            count(*) FILTER (WHERE r.status IN ('failed','blocked','rejected'))::int AS failed,
            COALESCE(SUM(r.cost_usd), 0)::float                        AS cost_usd,
            MAX(r.started_at)                                          AS last_active
       FROM task_runs r
       LEFT JOIN personas p  ON p.persona_id = r.persona_id
       LEFT JOIN roles    ro ON ro.role_id = p.role_id
      GROUP BY r.persona_id, p.persona_name, ro.role
      ORDER BY runs DESC, r.persona_id`,
  );
  return rows;
}

export interface EventRow {
  id: number;
  cycle_id: number | null;
  type: string;
  persona_id: string | null;
  message: string | null;
  created_at: string;
}

/** Recent timeline events (engine + medium), newest first. */
export async function recentEvents(limit = 50): Promise<EventRow[]> {
  const { rows } = await query<EventRow>(
    `SELECT id, cycle_id, type, persona_id, message, created_at
       FROM events ORDER BY id DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

export interface BoardRow {
  task_id: string;
  task_name: string;
  task_status: string | null;
  auto: boolean;
  assignee_persona_id: string | null;
  dispatch_status: string | null;
  cycle_no: number | null;
}

/** Task/dispatch board: every task with its latest dispatch (if any). */
export async function taskBoard(): Promise<BoardRow[]> {
  const { rows } = await query<BoardRow>(
    `SELECT t.task_id, t.task_name, t.status AS task_status, t.auto,
            d.assignee_persona_id, d.status AS dispatch_status, d.cycle_no
       FROM tasks t
       LEFT JOIN LATERAL (
         SELECT assignee_persona_id, status, cycle_no
           FROM dispatch d2 WHERE d2.task_id = t.task_id
          ORDER BY d2.cycle_no DESC NULLS LAST, d2.id DESC LIMIT 1
       ) d ON true
      ORDER BY t.task_id`,
  );
  return rows;
}

export interface MediumThreadRow {
  id: string;
  title: string | null;
  updated_at: string;
  messages: number;
  last_persona_id: string | null;
}

/** Recent medium threads (the founder ↔ persona conversations from the gateway). */
export async function mediumThreads(limit = 30): Promise<MediumThreadRow[]> {
  const { rows } = await query<MediumThreadRow>(
    `SELECT s.id, s.title, s.updated_at,
            (SELECT count(*)::int FROM chat_messages m WHERE m.session_id = s.id) AS messages,
            (SELECT m.persona_id FROM chat_messages m
              WHERE m.session_id = s.id AND m.persona_id IS NOT NULL
              ORDER BY m.id DESC LIMIT 1) AS last_persona_id
       FROM chat_sessions s
      WHERE s.kind = 'medium'
      ORDER BY s.updated_at DESC
      LIMIT $1`,
    [limit],
  );
  return rows;
}

export interface ThreadMessageRow {
  role: 'user' | 'assistant';
  content: string;
  persona_id: string | null;
  created_at: string;
}

/** Messages of one medium thread, oldest first. */
export async function threadMessages(sessionId: string): Promise<ThreadMessageRow[]> {
  const { rows } = await query<ThreadMessageRow>(
    `SELECT role, content, persona_id, created_at
       FROM chat_messages WHERE session_id = $1 ORDER BY id`,
    [sessionId],
  );
  return rows;
}
