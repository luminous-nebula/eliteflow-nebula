# EliteFlow Nebula v2

A containerized service that takes a business idea → requirements → planning → tasks →
and **builds the selected project**, orchestrating a team of AI **persona** agents through a
single, conductor-driven pipeline. It is the successor to the file-based AgentFlow
Nebula system: structured data moves to **Postgres**, the workflow becomes an atomic
**work-cycle**, a deterministic **engine** drives the sequence, and **Mensa Nebula**
(an LLM persona) plans and routes. Each persona runs as a headless **Claude Code**
worker. A **web UI** shows the board, runs, and a question inbox.

> The 2026-06 reorganization (an external steward/medium as the human front door, a
> monitor-only UI, a GUI installer, and atomic Mensa-orchestrated cycles) is recorded in
> [`docs/adr/0002-system-reorganization.md`](docs/adr/0002-system-reorganization.md).

> **Testing it for the first time? Follow [`docs/user-guide.md`](docs/user-guide.md)** —
> install → login → connect → run a free dry-run cycle → verify.
>
> Full design: [`docs/architecture.md`](docs/architecture.md) and
> [`docs/adr/0001-containerized-orchestration-architecture.md`](docs/adr/0001-containerized-orchestration-architecture.md).

## Quick start

**Windows (GUI installer — primary).** Build and run the Electron installer (ADR-0002 D4):

```sh
cd installer && npm install && npm run dist   # → release/*.exe (double-click to run)
```

The installer wizard captures config + the Claude credential (browser `claude setup-token`),
writes `.env`, and starts the stack; afterwards it doubles as a **control panel**
(start / stop / clean-wipe / open dashboard / logs). See [`installer/README.md`](installer/README.md).

**POSIX / headless fallback.**

```sh
./install.sh       # prompts for config, writes .env, runs docker compose
```

Either path asks for the project name, workspace path, source-repo path, a database
password, ports, and a Claude credential; writes `.env`; then brings up the stack with
`docker compose up -d --build` and seeds the database from your existing CSVs.

**First run.** Open the UI at `http://localhost:<WEB_PORT>` and **set an operator
password** — this protects the monitor dashboard.

The web app is a **monitor-only dashboard** (ADR-0002 D3): it shows cycles, the task
board, per-persona activity, cost, the event timeline, medium threads, and the question
inbox — it does not drive work. The Claude credential is supplied out-of-band: the GUI
installer captures it (browser `claude setup-token`) and writes it to `.env`, or set
`CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY` there yourself. (The in-app credential page
was retired with the planning console.)

## What runs (docker compose)

| Service | Role |
|---|---|
| `postgres` | Relational source of truth (replaces the structured CSVs). |
| `migrate` | One-shot: applies schema migrations, then seeds from the workspace CSVs. |
| `orchestrator` | Node engine + Claude Code (headless). Runs atomic work-cycles. |
| `web` | Next.js monitor dashboard. Overview, board, activity timeline, medium threads, question inbox. |

The workspace (`instruction/`, `persona/`, the target repo) is **mounted** — narrative
process/identity stays in version-controlled markdown; only tabular data lives in the DB.

## Repository layout

```
packages/db/            schema SQL, migration runner, CSV->DB seeder, shared types
services/orchestrator/  work-cycle engine, Claude Code worker, Mensa planner/router,
                        permission-prompt MCP tool
apps/web/               Next.js monitor dashboard (overview, board, activity, medium, inbox)
installer/              Electron GUI installer + control panel (ADR-0002 D4)
infra/                  docker-compose.yml + Dockerfiles
docs/                   architecture overview + ADRs
install.sh              POSIX / headless installer (writes .env, runs docker compose)
```

## Local development (without Docker)

```sh
npm install
# point DATABASE_URL at a local Postgres, then:
npm run migrate
npm run seed
npm run run-cycle      # execute a single work-cycle once
npm run web            # start the dashboard on http://localhost:3000
```

See `.env.example` for all configuration.
