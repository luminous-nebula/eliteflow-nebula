-- ─────────────────────────────────────────────────────────────────────────────
-- 001_core.sql — ported structured tables (formerly the database/**/*.csv files)
-- Natural keys (kebab-case ids) are preserved as text primary keys.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── lookup / reference tables ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_status (
  status       text PRIMARY KEY,
  sort_order   integer NOT NULL,
  description  text
);

CREATE TABLE IF NOT EXISTS persona_status (
  status       text PRIMARY KEY,
  description  text
);

CREATE TABLE IF NOT EXISTS bug_status (
  status       text PRIMARY KEY,
  sort_order   integer NOT NULL,
  description  text
);

CREATE TABLE IF NOT EXISTS bug_severity (
  severity        text PRIMARY KEY,
  sort_order      integer NOT NULL,
  description     text,
  target_response text
);

CREATE TABLE IF NOT EXISTS months (
  month_no  integer PRIMARY KEY,
  month     text NOT NULL,
  short     text NOT NULL
);

CREATE TABLE IF NOT EXISTS days_of_week (
  day_no       integer PRIMARY KEY,
  day_of_week  text NOT NULL,
  short        text NOT NULL
);

CREATE TABLE IF NOT EXISTS config (
  property  text PRIMARY KEY,
  value     text
);

-- ── org structure ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  team_id      text PRIMARY KEY,
  team         text NOT NULL,
  tier_order   integer NOT NULL,
  description  text
);

CREATE TABLE IF NOT EXISTS roles (
  role_id      text PRIMARY KEY,
  role         text NOT NULL,
  team_id      text NOT NULL REFERENCES teams(team_id),
  description  text
);

CREATE TABLE IF NOT EXISTS personas (
  persona_id    text PRIMARY KEY,
  persona_name  text NOT NULL,
  role_id       text NOT NULL REFERENCES roles(role_id),
  team_id       text NOT NULL REFERENCES teams(team_id),
  status        text NOT NULL REFERENCES persona_status(status),
  origin        text,
  persona_file  text
);

-- ── prompt library & schedules ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_helpers (
  persona_id       text PRIMARY KEY REFERENCES personas(persona_id),
  initial_persona  text,
  scheduled_task   text,
  export_prompt    text,
  import_prompt     text
);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  schedule_id  text PRIMARY KEY,
  persona_id   text NOT NULL REFERENCES personas(persona_id),
  cron         text,
  action       text,
  purpose      text,
  status       text,
  prompt       text
);

-- ── projects / phases / tasks ───────────────────────────────────────────────
-- Qualitative scoring columns are kept as text exactly as authored in the sheet.
CREATE TABLE IF NOT EXISTS projects (
  project_id      text PRIMARY KEY,
  priority        integer,
  project_name    text NOT NULL,
  status          text,
  target_market   text,
  pain_intensity  text,
  revenue_potential text,
  strategic_fit   text,
  moat            text,
  autonomy        text,
  ease_of_execution text,
  speed_to_mvp    text,
  weeks_to_mvp    text,
  total_score     text,
  description     text,
  project_folder  text
);

CREATE TABLE IF NOT EXISTS phases (
  phase_id     text PRIMARY KEY,
  project_id   text NOT NULL REFERENCES projects(project_id),
  phase_no     integer,
  phase_name   text,
  status       text,
  description  text
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id         text PRIMARY KEY,
  project_id      text REFERENCES projects(project_id),
  phase_id        text REFERENCES phases(phase_id),
  task_name       text NOT NULL,
  description     text,
  hours           numeric,
  cycles          integer,
  status          text REFERENCES task_status(status),
  auto            boolean NOT NULL DEFAULT false,
  task_type       text,
  date_started    date,
  date_completed  date
);

-- One row per dispatch (assignment of a task to a persona within a cycle).
CREATE TABLE IF NOT EXISTS dispatch (
  id                  bigserial PRIMARY KEY,
  date                date,
  cycle_no            integer,
  task_id             text NOT NULL REFERENCES tasks(task_id),
  assignee_persona_id text NOT NULL REFERENCES personas(persona_id),
  instructions        text,
  status              text
);

CREATE TABLE IF NOT EXISTS bugs (
  bug_id              text PRIMARY KEY,
  project_id          text REFERENCES projects(project_id),
  phase_id            text REFERENCES phases(phase_id),
  title               text NOT NULL,
  severity            text REFERENCES bug_severity(severity),
  status              text REFERENCES bug_status(status),
  reporter_persona_id text REFERENCES personas(persona_id),
  assignee_persona_id text REFERENCES personas(persona_id),
  fix_task_id         text REFERENCES tasks(task_id),
  date_reported       date,
  date_resolved       date,
  bug_ref             text
);

-- Estimated hours per task per day (planning ledger).
CREATE TABLE IF NOT EXISTS task_plan (
  id       bigserial PRIMARY KEY,
  task_id  text NOT NULL REFERENCES tasks(task_id),
  date     date,
  hours    numeric
);

CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_phase       ON tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_task     ON dispatch(task_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_assignee ON dispatch(assignee_persona_id);
