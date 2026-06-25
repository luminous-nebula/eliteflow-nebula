# EliteFlow Nebula v2 — Architecture

EliteFlow Nebula v2 is a **containerized service that orchestrates a team of AI "persona"
agents to do software work**. It replaces the previous file-based system (CSV tables +
markdown persona identities, each persona run as an independent interactive Claude/
Antigravity chat) with a single **conductor-driven pipeline**.

A deterministic engine drives the work; an LLM persona ("Mensa Nebula") is consulted only
at decision points. Personas still execute their existing written instructions unchanged.
Structured, transactional data moves to Postgres, while process and identity stay as
version-controlled markdown.

> The architectural decisions summarized here are recorded in full, with rationale and
> alternatives, in [`docs/adr/0001-containerized-orchestration-architecture.md`](./adr/0001-containerized-orchestration-architecture.md).
>
> **What the service does:** it takes a business idea → requirements → planning → tasks →
> and **builds the selected project** (the product lands in `product/`). We develop the
> **platform** (`app/`), not the downstream projects it produces.
>
> **2026-06 reorganization** refines the operating model — an external steward/medium
> (Regent Systemo) as the human front door, a monitor-only web UI, a GUI installer, and
> atomic Mensa-orchestrated work cycles. See
> [`docs/adr/0002-system-reorganization.md`](./adr/0002-system-reorganization.md).

---

## System at a glance

- **Deterministic engine** owns sequencing, state, retries, and commits. It is idempotent
  and resumable across container restarts.
- **Mensa Nebula (LLM)** is invoked only to **plan** the dispatch order and to **route** on
  feedback (e.g. re-assign on a rejected diff vs. escalate).
- **Workers** are non-interactive **Claude Code headless** invocations
  (`claude -p … --output-format json --allowedTools … --permission-prompt-tool …`). This
  is the sole automated execution backend; Antigravity remains a manual/dev surface only.
- **Permissions are pre-authorized.** A custom permission tool auto-approves in-scope
  actions and routes anything else to an async **questions inbox** instead of blocking.
- **Postgres** holds all structured/runtime state; **markdown** (mounted read-only) holds
  process and identity.

---

## Container topology

The system runs as four Docker Compose services over a shared workspace volume.

| Service | Stack | Responsibility |
|---|---|---|
| `postgres` | PostgreSQL | The relational database — all ported and runtime tables. |
| `orchestrator` | Node/TypeScript + Claude Code (headless) | Runs the deterministic engine, spawns persona workers, calls Mensa at decision points. Mounts the workspace volume. Fires cycles on a cron schedule or on demand. |
| `web` | Next.js (UI + API) | The web-based UI and API. Streams live updates via **SSE**. |
| `migrate` | One-shot job | Applies schema migrations and **seeds the DB from the existing CSVs**, then exits. |

### Mounted workspace

The `orchestrator` mounts a **workspace volume** containing:

- `instruction/` — the personas' written work instructions (process), **read-only**.
- `persona/*.md` — persona identity files, **read-only**.
- The **target source repository** the team operates on.

Keeping `instruction/` and `persona/*.md` as mounted, git-tracked, read-only files
preserves the single-source-of-truth split — *tabular data lives in Postgres, narrative
process lives in markdown* — and keeps process changes diffable in git, decoupled from DB
migrations.

### Authentication and secrets

The container runs unattended, so it cannot perform the **interactive** OAuth browser
popup at run time. Authentication therefore uses a credential supplied as an env var —
**one of**:

- **`CLAUDE_CODE_OAUTH_TOKEN`** — minted once on the host with `claude setup-token` (that
  command is the browser login). Uses the operator's Claude subscription; no per-token bill.
  Preferred.
- **`ANTHROPIC_API_KEY`** — an Anthropic Console key, billed per token.

The worker passes whichever is configured. Secrets are provided via **`.env` / docker
secrets** and are **never baked into the image**.

The orchestrator can also read the credential from the database, stored **encrypted
(AES-256-GCM)**, falling back to the env var. (The in-app **Connect Claude** page that wrote
that row was retired with the monitor-only reorganization — ADR-0002 D3; a GUI step to
capture and store it returns with the installer, workstream E. Until then the env var is the
path.) The monitor dashboard sits behind a single **operator login** (scrypt-hashed
password, HMAC-signed session cookie); it is read-only and cannot trigger spend. The
credential-encryption key and the session-signing key both derive from `APP_SECRET`.

---

## Data model

Existing CSV tables port to Postgres roughly **1:1**. New **runtime** tables capture the
state the engine, Mensa, and the UI need.

### Ported tables (from the CSVs)

| Table | Purpose |
|---|---|
| `teams` | Team definitions. |
| `roles` | Role definitions. |
| `personas` | The persona roster. |
| `projects` | Projects under management. |
| `phases` | Project phases. |
| `tasks` | Units of work. |
| `dispatch` | Dispatched task assignments. |
| `bugs` | Defects. |
| status lookup tables | Status enumerations referenced by the above. |
| `prompt_helpers` | Reusable prompt fragments. |
| `scheduled_tasks` | Cron-driven workflow definitions. |
| `config` | Instance configuration. |

### Runtime tables (new)

| Table | Purpose |
|---|---|
| `work_cycles` | One row per cron-fired cycle: status, started/ended timestamps, trigger. |
| `task_runs` | One per persona invocation: input context, structured output, token cost, status, retries. This is the **"feedback" Mensa waits on**. |
| `questions` | The async inbox: cycle, persona, question text, blocking flag, answer, `resolved_at`. |
| `permissions` | Pre-authorized scopes (tool/path globs) the permission tool checks. |
| `events` | Append-only audit/timeline that feeds the UI. |

---

## The work-cycle lifecycle

Scheduled workflows are modeled as **atomic work-cycles**. Each cycle is opened, runs its
ready tasks in dependency order, and is committed atomically; an interrupted cycle is
**reopened and resumed** rather than restarted.

```text
on cron "run-cycle":
  cycle = open_work_cycle()
  plan  = mensa_plan(cycle)              # LLM only if dispatch needs (re)planning
  for task in plan.ready_tasks():        # dependency-ordered, Auto=TRUE
     run = spawn_worker(task.assignee, task, cycle)  # claude -p, pre-authorized
     persist(run); update_task_status(task, run.status)
     record_questions(run.questions)     # → inbox, never blocks
     next = mensa_route(run) or pipeline_default(task)  # engineer→reviewer→qa
     if next: enqueue(next)
  close_work_cycle(cycle)                # atomic commit; resumable
```

Step by step:

1. **Open** a `work_cycles` row (triggered by cron or on demand).
2. **Plan.** Mensa is asked for the dispatch order — but only when dispatch needs
   (re)planning; otherwise the engine proceeds with the existing plan.
3. **For each ready task** (dependency-ordered, eligible for automation):
   - **Spawn** the assignee as a pre-authorized headless worker.
   - **Persist** the resulting `task_run` and update the task's status.
   - **Record questions** to the inbox — this never blocks the cycle.
   - **Route.** Mensa decides the next step on feedback; otherwise the engine falls back
     to the default pipeline (engineer → reviewer → QA). Any next step is enqueued.
4. **Close** the cycle with an atomic commit.

The deterministic engine owns all sequencing, persistence, and commit; Mensa contributes
only the planning and routing judgment.

---

## Permission and question model

A scheduled cycle must **never** raise an interactive permission popup. Two layers enforce
this:

1. **Allow-list pre-authorization.** Claude Code `settings.json` `permissions.allow`
   pre-authorizes the in-scope tools and paths each persona needs.
2. **Custom `--permission-prompt-tool` (MCP).** It intercepts anything not already
   pre-authorized and:
   - **auto-approves** requests within the persona's pre-authorized scope (checked against
     the `permissions` table), and
   - for anything out of scope, **writes a row to the `questions` table** and
     **denies-without-blocking**, so the run continues and finishes.

Questions surface in the web UI for asynchronous human resolution. The result: scheduled
cycles run to completion unattended, and open questions are visible without ever stalling a
run.

---

## Repository layout

A single monorepo using **root npm workspaces**:

```text
eliteflow-nebula/               # everything lives here
├── app/                         # THIS application (npm workspaces monorepo) — details below
├── workspace/                   # instruction/, persona/, database/ CSVs (mounted; WORKSPACE_PATH)
└── product/                     # code the personas generate/edit (mounted; SOURCE_REPO_PATH)

app/
├── package.json                 # root npm workspaces
├── install.sh                   # POSIX / headless installer (writes .env, runs docker compose)
├── installer/                   # Electron GUI installer + control panel (ADR-0002 D4)
├── packages/
│   └── db/                      # schema SQL + migrate + seed (CSV→DB ETL)
├── services/
│   └── orchestrator/            # engine, worker, mensa, medium/gateway, permission MCP tool
├── apps/
│   └── web/                     # Next.js monitor dashboard (read-only)
├── infra/                       # docker-compose + Dockerfiles
└── docs/                        # ADRs and architecture docs (this file)
```

| Path | Contents |
|---|---|
| `packages/db` | Schema SQL, migration runner, and the seed/ETL that loads Postgres from the existing CSVs. |
| `services/orchestrator` | The deterministic **engine**, the **worker** abstraction (Claude Code headless backend), the **Mensa** planner/router, and the custom **permission MCP tool**. |
| `apps/web` | The Next.js monitor-only dashboard (read-only views over the runtime tables). |
| `installer` | The Electron GUI installer + control panel: captures config + the Claude credential, writes `.env`, and drives `docker compose` (ADR-0002 D4). |
| `infra` | `docker-compose` definition and the per-service Dockerfiles. |
| `install.sh` | POSIX / headless installer: prompts for required information and runs `docker compose`. |
| `docs/` | Architecture documentation and ADRs, including ADR 0001. |

---

## Delivery phasing

The build is sequenced to de-risk early and ship value incrementally:

1. **Headless runner + permission/question model** on the existing CSVs.
2. **Postgres + CSV→DB ETL.**
3. **Work-cycle engine + Mensa planner/router.**
4. **Web UI** — read-only first, then controls.
5. **Installer + hardening** (secrets, rate-limit and cost controls).
