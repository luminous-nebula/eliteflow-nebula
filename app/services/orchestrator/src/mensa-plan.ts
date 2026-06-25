import { query } from '@eliteflow/db';
import { config } from './config.js';
import { log } from './logger.js';
import { runPersonaChat } from './persona-chat.js';
import type { WorkItem } from './mensa.js';

/**
 * LLM-Mensa planning (ADR-0002 D5, workstream C6). Opt-in via MENSA_PLANNING: when a
 * scheduled work_cycle fires, Mensa Nebula (engineering-manager) is asked — through the
 * persona runner — to ORDER this cycle's candidate work items. The deterministic
 * dispatch read remains both the source of candidates and the fallback: Mensa reorders
 * judgmentally, she does not invent or drop work (unmentioned items run last).
 */

const MENSA_PERSONA = 'mensa-nebula';

const PLANNING_MODE = [
  'OPERATING MODE — Cycle planning. You are orchestrating one atomic work-cycle. Below are',
  'the candidate work items (already filtered to automatable, open dispatches) and the',
  "cycle's purpose. Decide the order they should run in, considering dependencies and the",
  'hand-off chain (engineer → reviewer → QA).',
  'Respond with ONLY a fenced JSON block, no prose:',
  '```json',
  '{ "order": ["TASK-ID-FIRST", "TASK-ID-NEXT"] }',
  '```',
  'List task ids in execution order. Omit none unless truly out of scope; any you omit run',
  'last in their original order.',
].join('\n');

interface ScheduleCtx { purpose: string | null; prompt: string | null }

async function loadSchedule(scheduleId: string): Promise<ScheduleCtx> {
  const { rows } = await query<ScheduleCtx>(
    `SELECT purpose, prompt FROM scheduled_tasks WHERE schedule_id = $1`, [scheduleId]);
  return rows[0] ?? { purpose: null, prompt: null };
}

function buildRequest(ctx: ScheduleCtx, candidates: WorkItem[]): string {
  const list = candidates
    .map((c, i) => `${i + 1}. task ${c.taskId} → ${c.assigneePersonaId}: ${c.instructions || '(no instructions)'}`)
    .join('\n');
  return [
    ctx.purpose ? `Cycle purpose: ${ctx.purpose}` : '',
    ctx.prompt ? `Cycle prompt: ${ctx.prompt}` : '',
    '', 'Candidate work items:', list,
  ].filter(Boolean).join('\n');
}

/** Pull the task-id order out of Mensa's reply (fenced json first, then a bare object).
 *  Exported for unit testing of the parse/reorder logic. */
export function parseOrder(reply: string): string[] | null {
  const fenced = [...reply.matchAll(/```json\s*([\s\S]*?)```/g)];
  const candidate = fenced.length ? fenced[fenced.length - 1]![1]! : reply.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) return null;
  try {
    const obj = JSON.parse(candidate) as { order?: unknown };
    if (!Array.isArray(obj.order)) return null;
    return obj.order.filter((x): x is string => typeof x === 'string');
  } catch {
    return null;
  }
}

/** Reorder `candidates` by Mensa's task-id order; unmentioned items keep order, run last.
 *  Exported for unit testing of the parse/reorder logic. */
export function applyOrder(candidates: WorkItem[], order: string[]): WorkItem[] {
  const remaining = [...candidates];
  const ordered: WorkItem[] = [];
  for (const taskId of order) {
    const idx = remaining.findIndex((c) => c.taskId === taskId);
    if (idx >= 0) ordered.push(remaining.splice(idx, 1)[0]!);
  }
  return [...ordered, ...remaining];
}

/**
 * Ask Mensa to order the candidate plan. Returns the reordered list, or null to signal
 * the caller should keep the deterministic order (planning disabled, no schedule, no
 * candidates, dry-run, or an unparseable reply — all fall back safely).
 */
export async function orderViaMensa(
  scheduleId: string | null,
  candidates: WorkItem[],
): Promise<WorkItem[] | null> {
  if (!config.mensaPlanning || !scheduleId || candidates.length < 2) return null;
  if (config.dryRun) return null; // dry-run yields no real ordering; keep deterministic

  const ctx = await loadSchedule(scheduleId);
  const request = buildRequest(ctx, candidates);

  let reply: string;
  try {
    const turn = await runPersonaChat({
      personaId: MENSA_PERSONA,
      messages: [{ role: 'user', content: request }],
      operatingMode: PLANNING_MODE,
    });
    reply = turn.reply;
  } catch (err) {
    log.warn(`Mensa planning failed; using deterministic order`, (err as Error).message);
    return null;
  }

  const order = parseOrder(reply);
  if (!order || order.length === 0) {
    log.warn('Mensa returned no parseable order; using deterministic order');
    return null;
  }
  const reordered = applyOrder(candidates, order);
  log.info(`Mensa planned cycle order: ${reordered.map((c) => c.taskId).join(' → ')}`);
  return reordered;
}
