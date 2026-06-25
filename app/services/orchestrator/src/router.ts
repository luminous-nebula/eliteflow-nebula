import { query } from '@eliteflow/db';

/**
 * The router decides which persona should answer a founder message. This is the
 * deterministic "role/keyword map first" stage (ADR-0002 D2 / workstream C); an LLM
 * router can later replace `scoreRoles` without changing the rest of the medium.
 *
 * A keyword match yields a role; the role is resolved to a live, active persona from
 * the DB (so the map never points at a retired or renamed persona). When nothing
 * matches, the request falls back to the executive consultant as a general triage.
 */

export interface RouteResult {
  personaId: string;
  role: string;        // role_id chosen
  reason: string;      // why this route was taken (for logging / transparency)
}

/** role_id → keywords that route to it. Ordered by specificity in `scoreRoles`. */
const KEYWORD_MAP: Array<{ role: string; keywords: string[] }> = [
  { role: 'market-researcher',    keywords: ['market research', 'competitor', 'competitive', 'feature gap', 'tam', 'industry'] },
  { role: 'gtm-advisor',          keywords: ['gtm', 'go-to-market', 'pricing', 'positioning', 'demand', 'launch plan', 'channel'] },
  { role: 'marketing-lead',       keywords: ['marketing', 'campaign', 'seo', 'content', 'demand gen', 'brand awareness'] },
  { role: 'sales-lead',           keywords: ['sales', 'pipeline', 'lead', 'prospect', 'deal', 'customer discovery', 'outreach'] },
  { role: 'software-architect',   keywords: ['architecture', 'system design', 'schema', 'api contract', 'technical spec', 'design doc'] },
  { role: 'devops-engineer',      keywords: ['deploy', 'ci/cd', 'pipeline', 'infrastructure', 'infra', 'devops', 'release engineering'] },
  { role: 'product-designer',     keywords: ['ui', 'ux', 'design system', 'wireframe', 'mockup', 'interaction', 'visual'] },
  { role: 'qa-engineer',          keywords: ['qa', 'test plan', 'exploratory test', 'release sign-off', 'bug report'] },
  { role: 'code-reviewer',        keywords: ['code review', 'review the code', 'pull request', 'pr review'] },
  { role: 'unified-reviewer',     keywords: ['review', 'production readiness', 'audit the'] },
  { role: 'unified-engineer',     keywords: ['implement', 'build', 'code', 'fix', 'develop', 'feature', 'refactor', 'bug'] },
  { role: 'engineering-manager',  keywords: ['plan the cycle', 'orchestrate', 'dispatch', 'hand-off', 'sprint', 'coordinate', 'cadence'] },
  { role: 'executive-consultant', keywords: ['strategy', 'business', 'financial', 'finance', 'revenue', 'executive', 'plan', 'roadmap', 'idea'] },
];

/** Role to fall back to when no keyword matches — a general business triage. */
const FALLBACK_ROLE = 'executive-consultant';

interface Scored { role: string; hits: number; keyword: string }

/** Score each role by keyword hits; return the best (specific maps win ties by order). */
function scoreRoles(text: string): Scored | null {
  const t = text.toLowerCase();
  for (const { role, keywords } of KEYWORD_MAP) {
    const hit = keywords.find((k) => t.includes(k));
    if (hit) return { role, hits: 1, keyword: hit };
  }
  return null;
}

/** Resolve a role_id to a live active persona (lowest persona_id for determinism). */
async function activePersonaForRole(roleId: string): Promise<string | null> {
  const { rows } = await query<{ persona_id: string }>(
    `SELECT persona_id FROM personas
      WHERE role_id = $1 AND status = 'active'
      ORDER BY persona_id LIMIT 1`, [roleId]);
  return rows[0]?.persona_id ?? null;
}

/**
 * Route a founder message to a persona. Tries the keyword map, then the fallback
 * role, then — if even that role has no active persona — any active persona.
 */
export async function route(text: string): Promise<RouteResult> {
  const scored = scoreRoles(text);
  if (scored) {
    const personaId = await activePersonaForRole(scored.role);
    if (personaId) {
      return { personaId, role: scored.role, reason: `keyword "${scored.keyword}" → ${scored.role}` };
    }
  }

  const fallbackPersona = await activePersonaForRole(FALLBACK_ROLE);
  if (fallbackPersona) {
    return { personaId: fallbackPersona, role: FALLBACK_ROLE, reason: `no keyword match → fallback ${FALLBACK_ROLE}` };
  }

  // Last resort: any active persona at all, so the medium never dead-ends.
  const { rows } = await query<{ persona_id: string; role_id: string }>(
    `SELECT persona_id, role_id FROM personas WHERE status = 'active' ORDER BY persona_id LIMIT 1`);
  const any = rows[0];
  if (any) return { personaId: any.persona_id, role: any.role_id, reason: 'no active persona for fallback role → first active persona' };

  throw new Error('No active persona is available to route to.');
}
