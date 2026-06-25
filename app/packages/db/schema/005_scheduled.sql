-- ─────────────────────────────────────────────────────────────────────────────
-- 005_scheduled.sql — atomic, Mensa-orchestrated work cycles (reorg req 7)
--
-- The legacy model seeded one scheduled_tasks row per (persona × cycle), staggered by
-- clock time to fake sequencing. v2 instead fires ONE atomic work-cycle that Mensa plans
-- and the engine drives synchronously (engineer → reviewer → QA). These columns let the
-- orchestrator daemon drive cycles from the table and record which schedule fired each cycle.
-- ─────────────────────────────────────────────────────────────────────────────

-- 'work_cycle' = one atomic cycle the engine fires and Mensa orchestrates;
-- 'cadence'    = a standalone single-persona recurring schedule (e.g. weekly content).
ALTER TABLE scheduled_tasks
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'cadence';

-- Which schedule fired a given cycle (NULL for manual/api triggers).
ALTER TABLE work_cycles
  ADD COLUMN IF NOT EXISTS schedule_id text REFERENCES scheduled_tasks(schedule_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_kind ON scheduled_tasks(kind, status);
