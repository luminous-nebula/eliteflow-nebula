-- ─────────────────────────────────────────────────────────────────────────────
-- 006_medium.sql — the medium/gateway (ADR-0002 D2, workstream C)
-- The medium is a single founder-facing thread in which Regent routes each message
-- to the right persona and relays a signed reply. Unlike the planning console (004),
-- a medium thread is NOT bound to one persona: each turn may be answered by a
-- different persona, so attribution moves onto the individual message.
-- ─────────────────────────────────────────────────────────────────────────────

-- A medium thread spans many personas, so a session is no longer tied to one.
ALTER TABLE chat_sessions ALTER COLUMN persona_id DROP NOT NULL;

-- Distinguish a routed medium thread from the legacy single-persona planning console.
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'planning';
  -- planning | medium

-- Per-message persona attribution: which persona produced an assistant reply.
-- NULL for a user (founder) message; set for the routed persona's reply.
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS persona_id text REFERENCES personas(persona_id);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_kind ON chat_sessions(kind, updated_at DESC);
