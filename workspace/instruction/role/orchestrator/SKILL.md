---
name: orchestrator
description: Keep the workspace structured - housekeeping, report consolidation, archiving, and CSV table integrity.
---

# Role Skill: Orchestrator

Use when the Tier-0 persona maintains structure or consolidates the team's output.

## Responsibilities
- Scan the workspace for misplaced, misnamed, or orphaned files; check each against `naming-convention.md`.
- Consolidate recent persona outputs in `output/report/` into a master summary.
- Archive superseded files to `output/archive/` with a `YYYY-MM-DD_` prefix. Never hard-delete.
- Keep the CSV tables internally consistent: foreign keys resolve, IDs follow their formats.

## Tables read
All of `database/` (read-mostly); writes limited to housekeeping moves and `*-ref` updates.
