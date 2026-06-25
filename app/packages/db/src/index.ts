import pg from 'pg';

export * from './crypto.js';
export * from './credentials.js';
export * from './auth.js';
export * from './chat.js';

const { Pool } = pg;

/**
 * Shared Postgres pool. Reads DATABASE_URL from the environment.
 * All services import the pool / query helper from here so there is exactly one
 * connection configuration in the system.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX ?? 10),
});

export type QueryParams = ReadonlyArray<unknown>;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: QueryParams,
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as unknown[] | undefined);
}

/** Run `fn` inside a transaction, committing on success and rolling back on error. */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Domain types (subset used across services) ──────────────────────────────

export interface Persona {
  persona_id: string;
  persona_name: string;
  role_id: string;
  team_id: string;
  status: string;
  origin: string | null;
  persona_file: string | null;
}

export interface Task {
  task_id: string;
  project_id: string | null;
  phase_id: string | null;
  task_name: string;
  description: string | null;
  hours: string | null;
  cycles: number | null;
  status: string | null;
  auto: boolean;
  task_type: string | null;
  date_started: string | null;
  date_completed: string | null;
}

export interface DispatchRow {
  id: number;
  date: string | null;
  cycle_no: number | null;
  task_id: string;
  assignee_persona_id: string;
  instructions: string | null;
  status: string | null;
}

export interface WorkCycle {
  id: number;
  trigger: string;
  status: string;
  plan: unknown;
  notes: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface TaskRun {
  id: number;
  cycle_id: number;
  task_id: string | null;
  persona_id: string;
  role: string | null;
  status: string;
  attempt: number;
  input: unknown;
  output: unknown;
  summary: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_usd: string | null;
  error: string | null;
  started_at: string;
  ended_at: string | null;
}

/** Structured report a persona worker returns — the engine's unit of "feedback". */
export interface WorkerReport {
  status: 'done' | 'blocked' | 'rejected' | 'failed';
  summary: string;
  artifacts?: string[];
  questions?: Array<{ question: string; context?: string; blocking?: boolean }>;
  next_suggested_persona_id?: string | null;
}
