import 'dotenv/config';
import cron from 'node-cron';
import { pool } from '@eliteflow/db';
import { runCycle } from './engine.js';
import { loadWorkCycleSchedules } from './schedules.js';
import { config } from './config.js';
import { log } from './logger.js';

/**
 * Orchestrator daemon. Fires atomic work-cycles on a schedule.
 *
 * Primary model (reorg req 7): each active `kind = 'work_cycle'` row in scheduled_tasks is
 * one atomic, Mensa-orchestrated cycle; the daemon schedules each row's cron and fires it.
 * If there are no such rows, it falls back to the single env CYCLE_CRON (back-compat).
 *
 * Cycles never overlap: if one is still running when the next would fire, it is skipped.
 */

let running = false;

async function fire(scheduleId: string | null): Promise<void> {
  if (running) {
    log.warn(`skip: previous work-cycle still running (would fire ${scheduleId ?? 'CYCLE_CRON'})`);
    return;
  }
  running = true;
  try {
    await runCycle('cron', scheduleId);
  } catch (err) {
    log.error('work-cycle error', (err as Error).message);
  } finally {
    running = false;
  }
}

function scheduleCron(expr: string, scheduleId: string | null, label: string): boolean {
  if (!cron.validate(expr)) {
    log.error(`invalid cron for ${label}: "${expr}" — skipped`);
    return false;
  }
  cron.schedule(expr, () => void fire(scheduleId), { timezone: process.env.TIMEZONE || undefined });
  log.info(`scheduled ${label}: "${expr}" (${process.env.TIMEZONE ?? 'system tz'})`);
  return true;
}

async function main(): Promise<void> {
  let scheduled = 0;
  try {
    const schedules = await loadWorkCycleSchedules();
    for (const s of schedules) {
      if (scheduleCron(s.cron, s.scheduleId, `work-cycle ${s.scheduleId}`)) scheduled++;
    }
  } catch (err) {
    log.error('failed to load work-cycle schedules', (err as Error).message);
  }

  if (scheduled === 0) {
    // No table-driven work cycles — fall back to the single env-configured cron.
    if (!config.cycleCron) {
      log.warn('no active work_cycle schedules and CYCLE_CRON is empty — on-demand only (use `npm run run-cycle`).');
    } else {
      scheduleCron(config.cycleCron, null, 'CYCLE_CRON (fallback)');
    }
  } else {
    log.info(`orchestrator up — ${scheduled} table-driven work-cycle schedule(s) active`);
  }

  // Keep the process alive for the scheduler.
  process.stdin.resume();
}

main().catch(async (err) => {
  log.error('orchestrator failed to start', (err as Error).message);
  await pool.end();
  process.exit(1);
});
