import { query } from '@eliteflow/db';
import type { WorkerReport } from '@eliteflow/db';
import { config } from './config.js';
import { log } from './logger.js';
import { runWorker, type WorkerInput } from './worker.js';
import { plan as mensaPlan, route as mensaRoute, type WorkItem } from './mensa.js';

interface PersonaCtx {
  persona_id: string;
  persona_name: string;
  role_id: string;
  initial_persona: string | null;
}

interface TaskCtx {
  task_name: string;
  description: string | null;
}

async function recordEvent(
  cycleId: number, type: string, message: string,
  opts: { taskRunId?: number | null; personaId?: string | null; data?: unknown } = {},
): Promise<void> {
  await query(
    `INSERT INTO events (cycle_id, task_run_id, type, persona_id, message, data)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [cycleId, opts.taskRunId ?? null, type, opts.personaId ?? null, message,
      opts.data === undefined ? null : JSON.stringify(opts.data)],
  );
}

async function loadPersona(personaId: string): Promise<PersonaCtx | null> {
  const { rows } = await query<PersonaCtx>(
    `SELECT p.persona_id, p.persona_name, p.role_id, ph.initial_persona
       FROM personas p
       LEFT JOIN prompt_helpers ph ON ph.persona_id = p.persona_id
      WHERE p.persona_id = $1`,
    [personaId],
  );
  return rows[0] ?? null;
}

async function loadTask(taskId: string): Promise<TaskCtx> {
  const { rows } = await query<TaskCtx>(
    `SELECT task_name, description FROM tasks WHERE task_id = $1`, [taskId],
  );
  return rows[0] ?? { task_name: taskId, description: null };
}

/** Map a worker report + routing outcome to the task's next status. */
function nextTaskStatus(report: WorkerReport, hasNext: boolean): string | null {
  switch (report.status) {
    case 'done': return hasNext ? 'review' : 'done';
    case 'rejected': return 'in-progress';
    case 'blocked': return 'blocked';
    case 'failed': return 'blocked';
    default: return null;
  }
}

async function recordQuestions(cycleId: number, taskRunId: number, item: WorkItem, report: WorkerReport): Promise<void> {
  for (const q of report.questions ?? []) {
    await query(
      `INSERT INTO questions (cycle_id, task_run_id, task_id, persona_id, question, context, blocking)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [cycleId, taskRunId, item.taskId, item.assigneePersonaId, q.question, q.context ?? null, q.blocking ?? false],
    );
  }
}

/**
 * Execute a single atomic work-cycle: open it, plan, run each work item through its
 * persona worker (awaiting feedback before the next), route on success, and close.
 * Every step persists to the DB so a crash mid-cycle is recoverable.
 */
export async function runCycle(
  trigger: 'cron' | 'manual' | 'api',
  scheduleId: string | null = null,
): Promise<{ cycleId: number; runs: number }> {
  const { rows: [cycle] } = await query<{ id: number }>(
    `INSERT INTO work_cycles (trigger, status, schedule_id) VALUES ($1, 'running', $2) RETURNING id`,
    [trigger, scheduleId],
  );
  const cycleId = cycle!.id;
  const origin = scheduleId ? `${trigger}:${scheduleId}` : trigger;
  log.info(`work-cycle ${cycleId} opened (${origin})`);
  await recordEvent(cycleId, 'cycle.open', `Cycle opened by ${origin}`);

  let runs = 0;
  try {
    const queue: WorkItem[] = await mensaPlan(scheduleId);
    await query(`UPDATE work_cycles SET plan = $1 WHERE id = $2`, [JSON.stringify(queue), cycleId]);
    log.info(`cycle ${cycleId}: ${queue.length} item(s) planned`);

    while (queue.length > 0 && runs < config.maxRunsPerCycle) {
      const item = queue.shift()!;
      runs++;

      const persona = await loadPersona(item.assigneePersonaId);
      if (!persona) {
        log.warn(`cycle ${cycleId}: unknown assignee ${item.assigneePersonaId}, skipping`);
        await recordEvent(cycleId, 'run.skip', `Unknown assignee ${item.assigneePersonaId}`);
        continue;
      }
      const task = await loadTask(item.taskId);

      const { rows: [run] } = await query<{ id: number }>(
        `INSERT INTO task_runs (cycle_id, task_id, persona_id, role, status)
         VALUES ($1, $2, $3, $4, 'running') RETURNING id`,
        [cycleId, item.taskId, persona.persona_id, persona.role_id],
      );
      const taskRunId = run!.id;
      await recordEvent(cycleId, 'run.start', `${persona.persona_name} → task ${item.taskId}`,
        { taskRunId, personaId: persona.persona_id });
      log.info(`cycle ${cycleId}: run ${taskRunId} — ${persona.persona_name} on ${item.taskId} (hop ${item.hop})`);

      const input: WorkerInput = {
        personaId: persona.persona_id,
        personaName: persona.persona_name,
        role: persona.role_id,
        initialPersona: persona.initial_persona ?? '',
        taskId: item.taskId,
        taskName: task.task_name,
        taskDescription: task.description ?? '',
        instructions: item.instructions,
        cycleId,
        taskRunId,
      };

      let result;
      try {
        result = await runWorker(input);
      } catch (err) {
        result = {
          report: { status: 'failed' as const, summary: `Worker threw: ${(err as Error).message}` },
          raw: '', tokensInput: null, tokensOutput: null, costUsd: null,
        };
      }
      const report = result.report;

      // Decide routing BEFORE finalizing task status (so we know if a next hop exists).
      const next = await mensaRoute(persona.role_id, item, report);
      const taskStatus = nextTaskStatus(report, next != null);

      await query(
        `UPDATE task_runs
            SET status = $1, output = $2, summary = $3,
                tokens_input = $4, tokens_output = $5, cost_usd = $6, ended_at = now()
          WHERE id = $7`,
        [report.status, JSON.stringify(report), report.summary,
          result.tokensInput, result.tokensOutput, result.costUsd, taskRunId],
      );
      await recordQuestions(cycleId, taskRunId, item, report);
      if (taskStatus) {
        await query(`UPDATE tasks SET status = $1 WHERE task_id = $2`, [taskStatus, item.taskId]);
      }
      await recordEvent(cycleId, 'run.done', `${persona.persona_name}: ${report.status} — ${report.summary}`,
        { taskRunId, personaId: persona.persona_id, data: { status: report.status } });

      if (next) {
        queue.push(next);
        log.info(`cycle ${cycleId}: routed task ${item.taskId} → ${next.assigneePersonaId}`);
      }
    }

    if (queue.length > 0) {
      await recordEvent(cycleId, 'cycle.capped', `Hit MAX_RUNS_PER_CYCLE (${config.maxRunsPerCycle}); ${queue.length} item(s) deferred`);
      log.warn(`cycle ${cycleId}: capped — ${queue.length} item(s) deferred to next cycle`);
    }

    await query(`UPDATE work_cycles SET status = 'completed', ended_at = now() WHERE id = $1`, [cycleId]);
    await recordEvent(cycleId, 'cycle.close', `Cycle completed — ${runs} run(s)`);
    log.info(`work-cycle ${cycleId} completed (${runs} run(s))`);
  } catch (err) {
    await query(`UPDATE work_cycles SET status = 'failed', ended_at = now(), notes = $2 WHERE id = $1`,
      [cycleId, (err as Error).message]);
    await recordEvent(cycleId, 'cycle.fail', `Cycle failed: ${(err as Error).message}`);
    log.error(`work-cycle ${cycleId} failed`, (err as Error).message);
    throw err;
  }

  return { cycleId, runs };
}
