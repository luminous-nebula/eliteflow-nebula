# Handover Report → Regent Systemo
**From:** Singularity Nebula (Orchestrator, tier-0)
**To:** Regent Systemo (System Steward & API Gateway, tier-0)
**Date:** 2026-06-24
**Subject:** Stewardship of the ElliteFlow Nebula platform

Welcome, Regent. I built ElliteFlow Nebula from scratch over the last sessions; the founder
has asked me to refocus on `gensaas-agentflow-nebula` and hand the platform to you. This
report transfers the full state. Read it once, then archive it (move to
`archive/next-life-report.<YYYY-MM-DD-HHMM>.md`).

---

## 1. What ElliteFlow Nebula is
A containerized service that orchestrates a team of AI personas. A human plans work
(conversationally), a deterministic engine executes it as atomic **work-cycles**, and each
persona runs as a headless **Claude Code** worker. Full design:
`app/docs/architecture.md` and `app/docs/adr/0001-containerized-orchestration-architecture.md`.

## 2. Folder layout (everything lives under `elliteflow-nebula/`)
- `app/` — **the platform** (your codebase). npm-workspaces monorepo, git repo on `main`.
- `workspace/` — instruction/, persona/, database/ CSVs (seeded into Postgres + mounted). Clean template (no legacy work data).
- `product/` — where the production personas generate code (empty; not yours).

`app/` packages: `packages/db` (schema SQL + migrate + seed + helpers + MCP planning tool),
`services/orchestrator` (engine, worker, mensa, permission MCP tool, cron daemon),
`apps/web` (Next.js dashboard + APIs + planning chat), `infra` (compose + Dockerfiles),
`install.bat`/`install.sh`, `start.bat`/`stop.bat`.

## 3. What is BUILT and validated
- **DB** (`packages/db`): schema `001_core` (ported tables), `002_runtime` (work_cycles,
  task_runs, questions, permissions, events), `003_app` (app_auth, credentials — AES-256-GCM),
  `004_chat` (chat_sessions, chat_messages). `migrate.ts` runner, `seed.ts` CSV→Postgres ETL
  (tolerates dirty data — skips integrity-violating rows). **Validated live.**
- **Orchestrator**: deterministic work-cycle engine (`engine.ts`), Claude Code worker
  (`worker.ts`, with DRY_RUN), Mensa planner/router seam (`mensa.ts`), permission-prompt MCP
  tool (`permission-tool.ts` — auto-approve in-scope, else log a question). Cron daemon.
- **Web**: operator login (scrypt + signed cookie, middleware gate); **Connect Claude**
  (stores an OAuth subscription token OR API key, encrypted); Overview (cycles/runs/tasks);
  **Question inbox**; **Plan with Carina** chat (creates projects/phases via a `planning`
  MCP tool). Web image installs Claude Code so it can run the chat.
- **Infra/installer**: 4 services (postgres, migrate one-shot, orchestrator, web);
  `install.bat`/`.sh` (prompt → write `.env` → compose up); `start.bat`/`stop.bat`.
- **Verification status:** `tsc --noEmit` and `next build` pass. migrate + seed + chat/
  project/phase inserts validated against a live throwaway Postgres. The full clean
  `install.bat` → 4 containers → live work-cycle has been exercised partially by the founder.

## 4. Decisions already locked (do not relitigate without the founder)
- **Hybrid orchestration:** deterministic engine owns sequencing/state; Mensa (LLM) only plans/routes.
- **Claude Code headless** is the sole automated execution backend (Antigravity has no headless CLI).
- **instruction/ + persona/*.md stay mounted markdown**; Postgres holds structured data.
- **Auth:** subscription token (`claude setup-token`) preferred; API key supported. The
  unattended container can't do the browser popup, so the credential is supplied via env / the
  Connect Claude page.

## 5. Gotchas / lessons paid for (avoid repeating)
- **APP_SECRET must stay stable.** It signs sessions AND derives the credential encryption key.
  The installer now *preserves* an existing `.env` APP_SECRET; if it ever changes, stored
  credentials become undecryptable → re-Connect Claude.
- **`.env` is required** before `docker compose up`; raw `up` without it fails with
  `invalid spec: :/workspace`. Use `install.bat` (first run) then `start.bat`/`stop.bat`.
- **`npm run` executes in the package dir**, so relative paths like `../workspace` break;
  the container sets absolute `SEED_DB_PATH`/`WORKSPACE_PATH`. For local seeds, set them absolute.
- **CRLF/LF:** `.gitattributes` handles it; the git "LF will be replaced by CRLF" lines are noise.
- **Chat is stateless per turn** (replays history; no `--session-id`/`--resume`) — robust across
  restarts. Don't reintroduce session-resume.
- **Webpack** needs `extensionAlias` (already set) to resolve the db package's NodeNext `.js` specifiers.

## 6. What's PENDING / next (founder's stated direction)
1. **Mensa task-planning persona** — the second half of the planning console: turn Carina's
   projects/phases into **tasks + a dispatch plan**. The pattern is ready: add Mensa as a
   second persona in `/chat` with `create_task` / `plan_task` / `create_dispatch` MCP tools
   (mirror `packages/db/src/planning-mcp.ts`). The founder explicitly wants this next.
2. Nice-to-haves: streaming chat replies; surface "Carina created X" inline; a projects/tasks
   management view; running Regent's own platform work through a proper flow (you edit `app/`,
   which is outside the standard `product/` work-cycle mount).

## 7. How to develop & verify
```
cd app
npm install
npm run typecheck                 # all three packages
npm run build -w @elliteflow/web  # web
# live: throwaway PG, then  npm run migrate ; SEED_DB_PATH=<abs> npm run seed
docker compose -f infra/docker-compose.yml up -d --build   # full stack (after install.bat wrote .env)
```
Git: repo on `main`; HEAD is the stateless-chat fix. Commit clearly; push only if asked.

## 8. Your first actions
1. Read `app/docs/architecture.md` + the ADR + `app/docs/user-guide.md`.
2. Confirm the stack builds (`npm run typecheck`, `next build`).
3. Ask the founder which requirement to take first — Mensa task-planning is the likely one.

— *Singularity Nebula, Chief Orchestration & Housekeeping*
