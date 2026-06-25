# EliteFlow Nebula

An agentic AI system that takes a **business idea → requirements → planning → tasks → and
builds the selected project**, orchestrating a team of AI **persona** agents through a single,
conductor-driven pipeline. A deterministic engine drives atomic **work-cycles**; an LLM persona
(**Mensa Nebula**) plans and routes; each persona runs as a headless **Claude Code** worker; and
a monitor-only **web dashboard** shows the board, runs, cost, and a question inbox.

> This is the platform monorepo. The application itself lives in [`app/`](app/) — start there
> for setup and design. The full architecture is in
> [`app/docs/architecture.md`](app/docs/architecture.md), with rationale in
> [ADR-0001](app/docs/adr/0001-containerized-orchestration-architecture.md) and the 2026-06
> reorganization in [ADR-0002](app/docs/adr/0002-system-reorganization.md).

## Repository layout

```
eliteflow-nebula/
├── app/              The EliteFlow platform — npm-workspaces monorepo (THIS is the product we build)
├── workspace/        Service seed + mounted data: instruction/, persona/, database/ CSVs, docs
├── regent-systemo/   The external steward/medium's home (identity, role, operating notes)
└── product/          Code the personas generate/edit — not tracked (gitignored, mounted at runtime)
```

| Path | What it is |
|---|---|
| [`app/`](app/) | The platform codebase: `packages/db` (schema, migrations, CSV→DB seed), `services/orchestrator` (work-cycle engine, Claude Code worker, Mensa planner/router, medium/gateway, permission MCP tool), `apps/web` (Next.js monitor dashboard), `installer` (Electron GUI installer + control panel), `infra` (docker-compose + Dockerfiles), `docs` (architecture + ADRs). |
| `workspace/` | The service's mounted volume — personas' written `instruction/`, `persona/` identities, and the `database/` seed CSVs. Narrative process/identity stays in version-controlled markdown; tabular data is seeded into Postgres. |
| `regent-systemo/` | Home of **Regent Systemo**, the external **System Steward & API Gateway** who develops the platform and mediates between the founder, the system, and the personas. Outside the service roster. |
| `product/` | Downstream code the production personas generate. Mounted at runtime; **not part of this repo** (gitignored). |

## How it works (in brief)

- A **deterministic engine** owns sequencing, state, retries, and atomic commits — idempotent and
  resumable across container restarts.
- **Mensa Nebula (LLM)** is consulted only at decision points: to **plan** dispatch order and to
  **route** on feedback (e.g. re-assign a rejected diff vs. escalate).
- **Workers** are non-interactive **Claude Code headless** runs. Permissions are pre-authorized; a
  custom permission tool auto-approves in-scope actions and routes anything else to an async
  **questions inbox** instead of blocking.
- **Postgres** is the structured source of truth; **markdown** (mounted read-only) holds process and
  identity.
- The **web app is monitor-only** — it shows cycles, the task board, per-persona activity, cost, the
  event timeline, and medium threads; it does not drive work.

The system runs as four Docker Compose services: `postgres`, `migrate` (one-shot schema + seed),
`orchestrator` (engine + headless Claude Code), and `web` (Next.js dashboard).

## Quick start

The full, first-run walkthrough (install → login → connect → free dry-run cycle → verify) is in
[`app/docs/user-guide.md`](app/docs/user-guide.md).

**Windows (GUI installer — primary):**

```sh
cd app/installer && npm install && npm run dist   # → release/*.exe (double-click to run)
```

The wizard captures config + the Claude credential (browser `claude setup-token`), writes `.env`,
and starts the stack; afterwards it doubles as a **control panel** (start / stop / clean-wipe /
open dashboard / logs).

**POSIX / headless fallback:**

```sh
cd app && ./install.sh    # prompts for config, writes .env, runs docker compose
```

Either path provisions the database password, ports, workspace/product paths, and a Claude
credential (`CLAUDE_CODE_OAUTH_TOKEN` preferred, or `ANTHROPIC_API_KEY`), then brings up the stack
and seeds Postgres from the workspace CSVs. On first run, open `http://localhost:<WEB_PORT>` and set
an operator password to protect the dashboard.

## Local development

```sh
cd app && npm install
# point DATABASE_URL at a local Postgres, then:
npm run migrate && npm run seed
npm run run-cycle      # execute a single work-cycle once
npm run web            # dashboard on http://localhost:3000
```

See [`app/.env.example`](app/.env.example) for all configuration. Secrets live in `.env` and are
never committed — `APP_SECRET` (which signs sessions and derives the credential-encryption key) must
stay stable across re-installs.

## Status

Active development. The 2026-06 system reorganization (external steward/medium, monitor-only UI, GUI
installer, atomic Mensa-orchestrated cycles) is implemented — see
[ADR-0002](app/docs/adr/0002-system-reorganization.md). Day-to-day work happens on the `local`
branch.
