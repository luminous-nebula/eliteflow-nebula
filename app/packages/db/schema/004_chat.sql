-- ─────────────────────────────────────────────────────────────────────────────
-- 004_chat.sql — conversational planning console (human ↔ persona)
-- A session maps 1:1 to a Claude Code session id so the conversation is multi-turn.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_sessions (
  id          uuid PRIMARY KEY,                 -- also used as the Claude Code --session-id
  persona_id  text NOT NULL REFERENCES personas(persona_id),
  title       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          bigserial PRIMARY KEY,
  session_id  uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_persona ON chat_sessions(persona_id, updated_at DESC);
