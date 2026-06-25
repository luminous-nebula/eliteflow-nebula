import { query } from '@eliteflow/db';

/**
 * A work-cycle schedule: one atomic cycle the daemon fires and Mensa orchestrates.
 * Reshaped from the legacy per-persona staggered cron rows (reorg req 7) — each row here
 * is ONE atomic cycle, not one persona invocation.
 */
export interface WorkCycleSchedule {
  scheduleId: string;
  cron: string;
  action: string | null;
  purpose: string | null;
  /** Mensa's orchestration prompt for this cycle (LLM-planning seam). */
  prompt: string | null;
}

/**
 * Load the active `kind = 'work_cycle'` schedules. The daemon schedules each cron and fires
 * an atomic work-cycle for it; an empty result means fall back to the env CYCLE_CRON.
 */
export async function loadWorkCycleSchedules(): Promise<WorkCycleSchedule[]> {
  const { rows } = await query<{
    schedule_id: string; cron: string | null; action: string | null;
    purpose: string | null; prompt: string | null;
  }>(
    `SELECT schedule_id, cron, action, purpose, prompt
       FROM scheduled_tasks
      WHERE kind = 'work_cycle'
        AND COALESCE(lower(status), '') = 'active'
        AND cron IS NOT NULL AND cron <> ''
      ORDER BY cron, schedule_id`,
  );
  return rows.map((r) => ({
    scheduleId: r.schedule_id,
    cron: r.cron!,
    action: r.action,
    purpose: r.purpose,
    prompt: r.prompt,
  }));
}
