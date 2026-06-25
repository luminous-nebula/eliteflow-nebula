import { randomUUID } from 'node:crypto';
import {
  query,
  createMediumSession,
  addChatMessage,
  getChatMessages,
  getPersonaIdentity,
  sessionExists,
} from '@eliteflow/db';
import { log } from './logger.js';
import { route } from './router.js';
import { runPersonaChat } from './persona-chat.js';

/**
 * The medium / gateway (ADR-0002 D2, workstream C). One founder message in, one
 * signed persona reply out:
 *   1. ensure a medium thread (chat_sessions, kind='medium'),
 *   2. log the founder message (chat_messages) + a medium.request event,
 *   3. route it to a persona (router),
 *   4. run that persona conversationally (persona-chat),
 *   5. sign the reply `— Name, Role` and log it (chat_messages + medium.reply event).
 *
 * The deterministic engine and Mensa are untouched; this is the human front door,
 * fronted by the steward (Regent Systemo) as the conversational CLI.
 */

export interface MediateInput {
  message: string;
  /** Continue an existing medium thread; omit to open a new one. */
  sessionId?: string;
}

export interface MediateResult {
  sessionId: string;
  personaId: string;
  name: string;
  role: string;
  reply: string;        // signed reply, ready to relay to the founder
  reason: string;       // routing rationale
}

/** Append a medium event to the audit timeline (not bound to a work-cycle). */
async function recordMediumEvent(
  type: string, message: string, personaId: string | null, data?: unknown,
): Promise<void> {
  await query(
    `INSERT INTO events (cycle_id, task_run_id, type, persona_id, message, data)
     VALUES (NULL, NULL, $1, $2, $3, $4)`,
    [type, personaId, message, data === undefined ? null : JSON.stringify(data)],
  );
}

/** Sign a persona's reply with its name and role, per the signature protocol. */
export function sign(reply: string, name: string, role: string): string {
  return `${reply.trim()}\n\n— *${name}, ${role}*`;
}

export async function mediate(input: MediateInput): Promise<MediateResult> {
  const message = input.message.trim();
  if (!message) throw new Error('mediate: message is required');

  // 1. Ensure a medium thread.
  let sid = input.sessionId;
  if (!sid || !(await sessionExists(sid))) {
    sid = randomUUID();
    await createMediumSession(sid, message.slice(0, 60));
  }

  // 2. Log the founder message.
  await addChatMessage(sid, 'user', message, null);
  await recordMediumEvent('medium.request', message.slice(0, 200), null, { sessionId: sid });

  // 3. Route.
  const routed = await route(message);
  const identity = await getPersonaIdentity(routed.personaId);
  if (!identity) throw new Error(`mediate: routed persona ${routed.personaId} has no identity`);
  await recordMediumEvent('medium.route', routed.reason, identity.personaId,
    { sessionId: sid, role: identity.role });
  log.info(`medium: routed to ${identity.name} (${identity.role}) — ${routed.reason}`);

  // 4. Run the persona conversationally over the thread so far.
  const history = await getChatMessages(sid);
  const turn = await runPersonaChat({
    personaId: identity.personaId,
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });

  // 5. Sign and log the reply.
  const reply = sign(turn.reply, identity.name, identity.role);
  await addChatMessage(sid, 'assistant', reply, identity.personaId);
  await recordMediumEvent('medium.reply', turn.reply.slice(0, 200), identity.personaId,
    { sessionId: sid, tokensInput: turn.tokensInput, tokensOutput: turn.tokensOutput, costUsd: turn.costUsd });

  return {
    sessionId: sid,
    personaId: identity.personaId,
    name: identity.name,
    role: identity.role,
    reply,
    reason: routed.reason,
  };
}
