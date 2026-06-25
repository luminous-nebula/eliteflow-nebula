import { query } from '@eliteflow/db';
import type { WorkerReport } from '@eliteflow/db';
import { orderViaMensa } from './mensa-plan.js';

/**
 * Mensa Nebula — the planner/router. In v2 she is invoked by the deterministic engine
 * ONLY at decision points: ordering the dispatch plan, and routing on a worker's
 * feedback. Sequencing, state, and retries are owned by the engine, not by Mensa.
 *
 * This module currently implements deterministic defaults. The two functions are the
 * seams where an LLM Mensa call would plug in (reorder the plan / make a routing
 * judgment) without changing the engine.
 */

export interface WorkItem {
  taskId: string;
  assigneePersonaId: string;
  instructions: string;
  hop: number; // 0 = original dispatch, >0 = routed follow-up (review, etc.)
}

/** Role hand-off chain: who reviews/validates after a given role finishes. */
const PIPELINE: Record<string, string> = {
  'unified-engineer': 'unified-reviewer',
  'software-engineer': 'code-reviewer',
  'code-reviewer': 'qa-engineer',
};

/**
 * Build this cycle's ordered plan from the dispatch board: open assignments for
 * automatable tasks, in cycle/order.
 *
 * `scheduleId` identifies the `scheduled_tasks` work-cycle row that fired this atomic cycle
 * (null for manual/api triggers). The deterministic dispatch read produces the candidate
 * plan; when MENSA_PLANNING is enabled and a schedule fired the cycle, LLM-Mensa reorders
 * those candidates via the persona runner (see `mensa-plan.ts`). Mensa's reorder is a
 * judgment layer on top — she never invents or drops work, and any failure falls back to
 * the deterministic order.
 */
export async function plan(scheduleId: string | null = null): Promise<WorkItem[]> {
  const { rows } = await query<{ task_id: string; assignee_persona_id: string; instructions: string | null }>(
    `SELECT d.task_id, d.assignee_persona_id, d.instructions
       FROM dispatch d
       JOIN tasks t ON t.task_id = d.task_id
      WHERE t.auto = true
        AND COALESCE(lower(d.status), '') NOT IN ('done', 'completed', 'cancelled')
        AND COALESCE(lower(t.status), '') NOT IN ('done', 'archived')
      ORDER BY d.cycle_no NULLS LAST, d.id`,
  );
  const candidates: WorkItem[] = rows.map((r) => ({
    taskId: r.task_id,
    assigneePersonaId: r.assignee_persona_id,
    instructions: r.instructions ?? '',
    hop: 0,
  }));

  const reordered = await orderViaMensa(scheduleId, candidates);
  return reordered ?? candidates;
}

/**
 * Decide who (if anyone) should act next after a worker returns. Deterministic default
 * follows the role pipeline on success. (LLM seam: Mensa could adjudicate a rejection,
 * escalate, or re-assign with notes.)
 */
export async function route(
  finishedRole: string,
  item: WorkItem,
  report: WorkerReport,
): Promise<WorkItem | null> {
  if (report.status !== 'done') return null; // blocked/rejected/failed: engine handles, no auto-advance
  if (item.hop >= 2) return null; // cap hand-offs per task per cycle

  const nextRole = PIPELINE[finishedRole];
  if (!nextRole) return null;

  const { rows } = await query<{ persona_id: string }>(
    `SELECT persona_id FROM personas WHERE role_id = $1 AND status = 'active' ORDER BY persona_id LIMIT 1`,
    [nextRole],
  );
  const next = rows[0];
  if (!next) return null;

  return {
    taskId: item.taskId,
    assigneePersonaId: next.persona_id,
    instructions: `Review/validate the work just completed by ${item.assigneePersonaId} on task ${item.taskId}.`,
    hop: item.hop + 1,
  };
}
