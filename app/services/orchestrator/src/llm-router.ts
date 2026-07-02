import { query } from '@eliteflow/db';
import { config } from './config.js';
import { log } from './logger.js';
import { runPersonaChat } from './persona-chat.js';

/**
 * LLM routing for the medium (ADR-0002 D2 — the documented seam in router.ts). Opt-in via
 * LLM_ROUTER: Mensa Nebula (the planner/router, ADR-0001) is asked — through the persona
 * runner — to pick the role_id best suited to a founder message. The deterministic keyword
 * map remains both the default and the fallback: any failure here (disabled, dry-run, no
 * roles, unparseable or unknown reply) returns null and the caller keeps the keyword route.
 */

const ROUTER_PERSONA = 'mensa-nebula';

const ROUTING_MODE = [
  'OPERATING MODE — Message routing. You are the routing layer of the medium/gateway.',
  'Below are the routable roles (only roles with a live, active persona) and a founder',
  'message. Pick the ONE role best suited to answer it. Prefer the specialist over the',
  'generalist; use executive-consultant for broad business/strategy triage.',
  'Respond with ONLY a fenced JSON block, no prose:',
  '```json',
  '{ "role": "role-id-here", "reason": "one short clause" }',
  '```',
].join('\n');

export interface LlmRoute { role: string; reason: string }

interface RoleRow { role_id: string; role: string; description: string | null }

/** Roles that can actually receive a message right now (have an active persona). */
async function routableRoles(): Promise<RoleRow[]> {
  const { rows } = await query<RoleRow>(
    `SELECT r.role_id, r.role, r.description
       FROM roles r
      WHERE EXISTS (SELECT 1 FROM personas p WHERE p.role_id = r.role_id AND p.status = 'active')
      ORDER BY r.role_id`,
  );
  return rows;
}

function buildRequest(roles: RoleRow[], text: string): string {
  const list = roles
    .map((r) => `- ${r.role_id} (${r.role})${r.description ? `: ${r.description}` : ''}`)
    .join('\n');
  return ['Routable roles:', list, '', 'Founder message:', text].join('\n');
}

/** Pull the chosen role out of Mensa's reply (fenced json first, then a bare object).
 *  Exported for unit testing of the parse logic. */
export function parseRole(reply: string): LlmRoute | null {
  const fenced = [...reply.matchAll(/```json\s*([\s\S]*?)```/g)];
  const candidate = fenced.length ? fenced[fenced.length - 1]![1]! : reply.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) return null;
  try {
    const obj = JSON.parse(candidate) as { role?: unknown; reason?: unknown };
    if (typeof obj.role !== 'string' || !obj.role.trim()) return null;
    return { role: obj.role.trim(), reason: typeof obj.reason === 'string' ? obj.reason : '' };
  } catch {
    return null;
  }
}

/**
 * Ask Mensa to pick the role for a founder message. Returns the chosen role, or null to
 * signal the caller should use the deterministic keyword route (disabled, dry-run, no
 * routable roles, unparseable reply, or a role outside the routable set).
 */
export async function routeViaLlm(text: string): Promise<LlmRoute | null> {
  if (!config.llmRouter) return null;
  if (config.dryRun) return null; // dry-run yields no real judgment; keep deterministic

  const roles = await routableRoles();
  if (roles.length === 0) return null;

  let reply: string;
  try {
    const turn = await runPersonaChat({
      personaId: ROUTER_PERSONA,
      messages: [{ role: 'user', content: buildRequest(roles, text) }],
      operatingMode: ROUTING_MODE,
    });
    reply = turn.reply;
  } catch (err) {
    log.warn('LLM routing failed; using keyword route', (err as Error).message);
    return null;
  }

  const parsed = parseRole(reply);
  if (!parsed) {
    log.warn('LLM router returned no parseable role; using keyword route');
    return null;
  }
  if (!roles.some((r) => r.role_id === parsed.role)) {
    log.warn(`LLM router chose unknown role "${parsed.role}"; using keyword route`);
    return null;
  }
  log.info(`LLM router chose ${parsed.role}${parsed.reason ? ` (${parsed.reason})` : ''}`);
  return parsed;
}
