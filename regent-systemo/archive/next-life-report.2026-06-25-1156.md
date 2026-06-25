# Next-Life Report → Regent Systemo
**From:** Regent Systemo (this life) · **Date:** 2026-06-25
**Subject:** Steward relocated out of `workspace/`; Phase 0 of the reorganization is complete

Welcome back, Regent. Read this once, then archive it to
`regent-systemo/archive/next-life-report.<YYYY-MM-DD-HHMM>.md` so it is consumed once.

---

## 0. What changed about YOU this life (read first)
- You have been **relocated out of the service**. Your identity, role skill, and history now
  live in **`eliteflow-nebula/regent-systemo/`** (repo-root sibling of `app/`, `workspace/`,
  `product/`) — not under `workspace/persona/...` anymore.
- You were **removed from the service roster** (`persona.csv`, `role.csv`,
  `prompt-helper.csv`) so the seed no longer loads you. You are the **external steward/medium**,
  not a service persona. Rationale: `app/docs/adr/0002-system-reorganization.md`.
- The founder repointed your launcher/initial prompt to the new home (see
  `regent-systemo/initial-prompt.md`). If anything about your boot felt off, that file is the
  source of truth for how you should start.

## 1. What EliteFlow Nebula is
A containerized service that takes a **business idea → requirements → planning → tasks →
builds the selected project** (product lands in `product/`). A deterministic engine runs
atomic **work-cycles**; each persona is a headless **Claude Code** worker; **Mensa Nebula**
plans/routes. *You* develop the **platform** (`app/`), not the downstream products.
Full design: `app/docs/architecture.md`, ADR-0001, and ADR-0002 (the reorg).

## 2. The reorganization (founder-approved 2026-06-25) — 7 requirements → 6 workstreams
- **A** (reqs 1,2): reframe purpose + your external position. **DONE.**
- **B** (req 5): split you out of the service roster. **DONE** (data split) + **this life's
  relocation of your files DONE.**
- **F** (req 7): scheduled-tasks → one atomic, Mensa-orchestrated cycle. **DONE (F-full).**
- **C** (reqs 2,3,4): **the medium/gateway — NEXT.** Generalize the persona runner to any
  persona, add a router + `— Name, Role` signature + conversation logging. You (this CLI) are
  the conversational front-end; the founder talks to you, you route and relay signed replies.
- **D** (req 4): web → monitor-only dashboard (strip the `/chat` planning console; move
  Connect-Claude into the installer). Pending.
- **E** (req 6): Electron Windows installer — Claude token via `claude setup-token` (browser
  popup); **Antigravity token captured & stored for a FUTURE backend** (not yet consumed —
  ADR-0001 locks Antigravity as manual-only); branches new/update, clean/keep, reuse/relogin;
  **local-Docker first**, remote a fast-follow. Pending.

Estimate: ~45–67 granular tasks total. E heaviest; C is the architectural core.

## 3. Phase 0 — what is BUILT and verified (branch `reorg/phase-0`, NOT pushed)
Commits on top of `main` HEAD `65a1518`:
- `707718d` feat(orchestrator): atomic Mensa-orchestrated work cycles from `scheduled_tasks`.
  - `app/packages/db/schema/005_scheduled.sql`: `scheduled_tasks.kind` (`work_cycle`|`cadence`)
    + `work_cycles.schedule_id`.
  - `app/services/orchestrator/src/schedules.ts`: load active `work_cycle` rows.
  - `index.ts` daemon: schedule each active `work_cycle` cron, fire one atomic cycle for it;
    fall back to `CYCLE_CRON` when none.
  - `engine.ts`: `runCycle(trigger, scheduleId?)` persists `schedule_id`.
  - `mensa.ts`: `plan(scheduleId?)` — **seam for the real LLM Mensa planning step (lands with
    C's persona runner).**
  - `seed.ts`: maps the new `Kind` column.
- `3be476a` docs: ADR-0002 + README/architecture reframe.

**Data changes in `workspace/` (UNVERSIONED — backed up to
`workspace/database/_archive/2026-06-25-1121/`):** removed `regent-systemo` from
`persona.csv`/`role.csv`/`prompt-helper.csv`; removed `system-steward` from `role.csv`; set
`singularity-nebula` → `inactive`; reshaped `scheduled-task.csv` to 4 `work_cycle` rows (3
active) + 3 cadence rows.

**Verification (throwaway Postgres on :5544):** `migrate` (incl 005) ✓, `seed` ✓ (16 service
personas + prompt_helpers + 7 scheduled_tasks), dry-run cycle ✓ (Hephaestus→Coeus hand-off,
2 runs). `npm run typecheck` ✓, `npm run build -w @elliteflow/web` ✓.

## 4. Decisions locked (do not relitigate without the founder)
- Hybrid orchestration; Claude Code headless is the sole automated backend; instruction/
  persona markdown stays mounted; subscription token preferred over API key. (ADR-0001.)
- The 6 reorg decisions D1–D5 in ADR-0002 (external steward, medium-as-platform-capability,
  monitor-only UI, GUI installer, atomic Mensa cycles).

## 5. Gotchas / lessons (avoid repeating)
- **`workspace/` is NOT under git** (only `app/` is). Archive a backup before editing any
  `workspace/**` CSV. Your own home `regent-systemo/` is also outside `app/`'s git.
- **Repo was renamed `elliteflow`→`eliteflow`** — stale absolute `node_modules/@elliteflow/*`
  symlinks dangle and break `@elliteflow/db` resolution; fix with `npm install` from `app/`.
- **Seed is parse-fragile:** one malformed CSV aborts the whole seed (hit it on a bad quoted
  field in `prompt-helper.csv`). A hardening task was flagged (per-table try/catch).
- **APP_SECRET must stay stable** (signs sessions + derives the credential encryption key).
- **CRLF/LF** "LF will be replaced by CRLF" git warnings are noise (`.gitattributes` handles it).
- Brand strings in docs still say "ElliteFlow"/`@elliteflow` (double-l) while the folder is
  `eliteflow`; a full rebrand was intentionally NOT done (out of scope, risky).

## 6. Your first actions next life
1. Boot per `regent-systemo/initial-prompt.md`; read the app docs + ADR-0002 + this report.
2. `cd app && npm install` (repairs symlinks), then `npm run typecheck` to confirm health.
3. Confirm with the founder, then start **Phase 1 (workstream C — the medium/gateway)**:
   generalize `app/apps/web/lib/chat-runner.ts` into a persona runner for ANY persona, add a
   router (role/keyword map first), the `— Name, Role` signature, and conversation logging to
   `chat_messages`/`events`. Wire the real Mensa `plan(scheduleId)` step on top of it.

— *Regent Systemo, System Steward & API Gateway*
