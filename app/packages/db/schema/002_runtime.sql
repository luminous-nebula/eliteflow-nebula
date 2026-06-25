-- ─────────────────────────────────────────────────────────────────────────────
-- 002_runtime.sql — orchestration runtime tables (new in v2)
-- These hold the live state the deterministic engine reads/writes each work-cycle.
-- ─────────────────────────────────────────────────────────────────────────────

-- One row per cron-fired (or manually triggered) atomic work-cycle.
CREATE TABLE IF NOT EXISTS work_cycles (
  id          bigserial PRIMARY KEY,
  trigger     text NOT NULL DEFAULT 'cron',     -- cron | manual | api
  status      text NOT NULL DEFAULT 'running',  -- running | completed | failed | aborted
  plan        jsonb,                            -- Mensa's ordered plan for this cycle
  notes       text,
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz
);

-- One row per persona invocation (a single headless Claude Code run).
-- The `output` jsonb IS the structured "feedback" the engine waits on.
CREATE TABLE IF NOT EXISTS task_runs (
  id             bigserial PRIMARY KEY,
  cycle_id       bigint NOT NULL REFERENCES work_cycles(id) ON DELETE CASCADE,
  task_id        text REFERENCES tasks(task_id),
  persona_id     text NOT NULL REFERENCES personas(persona_id),
  role           text,                          -- persona's role at run time
  status         text NOT NULL DEFAULT 'running', -- running | done | blocked | rejected | failed
  attempt        integer NOT NULL DEFAULT 1,
  input          jsonb,                         -- context handed to the worker
  output         jsonb,                         -- parsed structured report
  summary        text,
  tokens_input   integer,
  tokens_output  integer,
  cost_usd       numeric,
  error          text,
  started_at     timestamptz NOT NULL DEFAULT now(),
  ended_at       timestamptz
);

-- The async question inbox (requirement #6). Filled when a run needs something it
-- was not pre-authorized for, instead of blocking with an interactive prompt.
CREATE TABLE IF NOT EXISTS questions (
  id           bigserial PRIMARY KEY,
  cycle_id     bigint REFERENCES work_cycles(id) ON DELETE SET NULL,
  task_run_id  bigint REFERENCES task_runs(id) ON DELETE SET NULL,
  task_id      text REFERENCES tasks(task_id),
  persona_id   text REFERENCES personas(persona_id),
  question     text NOT NULL,
  context      text,
  blocking     boolean NOT NULL DEFAULT false,
  status       text NOT NULL DEFAULT 'open',   -- open | answered | dismissed
  answer       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);

-- Pre-authorized permission scopes the permission-prompt MCP tool checks.
-- A request is auto-allowed iff it matches an enabled allow row and no deny row.
CREATE TABLE IF NOT EXISTS permissions (
  id            bigserial PRIMARY KEY,
  decision      text NOT NULL DEFAULT 'allow',  -- allow | deny
  tool_pattern  text NOT NULL,                  -- glob against tool name, e.g. Bash, Edit, mcp__*
  path_pattern  text,                           -- optional glob against a path argument
  description   text,
  enabled       boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Append-only audit/timeline that feeds the UI.
CREATE TABLE IF NOT EXISTS events (
  id           bigserial PRIMARY KEY,
  cycle_id     bigint REFERENCES work_cycles(id) ON DELETE CASCADE,
  task_run_id  bigint REFERENCES task_runs(id) ON DELETE CASCADE,
  type         text NOT NULL,                   -- cycle.open, run.start, run.done, question.logged, ...
  persona_id   text,
  message      text,
  data         jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_runs_cycle   ON task_runs(cycle_id);
CREATE INDEX IF NOT EXISTS idx_task_runs_status  ON task_runs(status);
CREATE INDEX IF NOT EXISTS idx_questions_status  ON questions(status);
CREATE INDEX IF NOT EXISTS idx_events_cycle      ON events(cycle_id);
CREATE INDEX IF NOT EXISTS idx_events_created    ON events(created_at);

-- Seed a sensible default permission allow-list (idempotent).
INSERT INTO permissions (decision, tool_pattern, path_pattern, description) VALUES
  ('allow', 'Read',  '**', 'Read any workspace file'),
  ('allow', 'Glob',  '**', 'List/search files'),
  ('allow', 'Grep',  '**', 'Search file contents'),
  ('allow', 'Edit',  '**', 'Edit files within the mounted repo'),
  ('allow', 'Write', '**', 'Write files within the mounted repo'),
  ('allow', 'Bash',  NULL, 'Run shell commands (scope further via deny rows)')
ON CONFLICT DO NOTHING;
