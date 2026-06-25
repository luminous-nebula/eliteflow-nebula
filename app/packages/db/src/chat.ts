import { query } from './index.js';

export interface ChatSession {
  id: string;
  persona_id: string | null;
  kind: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  persona_id: string | null;
  created_at: string;
}

export async function createChatSession(id: string, personaId: string, title: string | null): Promise<void> {
  await query(`INSERT INTO chat_sessions (id, persona_id, title) VALUES ($1, $2, $3)`, [id, personaId, title]);
}

/** Open a medium thread: a founder-facing conversation routed across many personas
 *  (so it is not bound to a single persona — see 006_medium.sql). */
export async function createMediumSession(id: string, title: string | null): Promise<void> {
  await query(
    `INSERT INTO chat_sessions (id, persona_id, kind, title) VALUES ($1, NULL, 'medium', $2)`,
    [id, title],
  );
}

export async function listChatSessions(personaId?: string): Promise<ChatSession[]> {
  const { rows } = personaId
    ? await query<ChatSession>(
        `SELECT * FROM chat_sessions WHERE persona_id = $1 ORDER BY updated_at DESC LIMIT 50`, [personaId])
    : await query<ChatSession>(`SELECT * FROM chat_sessions ORDER BY updated_at DESC LIMIT 50`);
  return rows;
}

export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const { rows } = await query<ChatMessage>(
    `SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY id`, [sessionId]);
  return rows;
}

export async function addChatMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  personaId: string | null = null,
): Promise<void> {
  await query(
    `INSERT INTO chat_messages (session_id, role, content, persona_id) VALUES ($1, $2, $3, $4)`,
    [sessionId, role, content, personaId],
  );
  await query(`UPDATE chat_sessions SET updated_at = now() WHERE id = $1`, [sessionId]);
}

export async function sessionExists(sessionId: string): Promise<boolean> {
  const { rows } = await query(`SELECT 1 FROM chat_sessions WHERE id = $1`, [sessionId]);
  return rows.length > 0;
}

export interface PersonaIdentity {
  personaId: string;
  name: string;
  role: string; // human-readable role label, for the `— Name, Role` signature
}

/** Resolve a persona's display name and role label — used to sign relayed replies. */
export async function getPersonaIdentity(personaId: string): Promise<PersonaIdentity | null> {
  const { rows } = await query<{ persona_name: string; role: string }>(
    `SELECT p.persona_name, r.role
       FROM personas p JOIN roles r ON r.role_id = p.role_id
      WHERE p.persona_id = $1`, [personaId]);
  const r = rows[0];
  return r ? { personaId, name: r.persona_name, role: r.role } : null;
}

/** The persona's display name + bootstrap prompt (used as the chat system prompt). */
export async function getPersonaPrompt(personaId: string): Promise<{ name: string; initial: string } | null> {
  const { rows } = await query<{ persona_name: string; initial_persona: string | null }>(
    `SELECT p.persona_name, ph.initial_persona
       FROM personas p LEFT JOIN prompt_helpers ph ON ph.persona_id = p.persona_id
      WHERE p.persona_id = $1`, [personaId]);
  const r = rows[0];
  return r ? { name: r.persona_name, initial: r.initial_persona ?? '' } : null;
}
