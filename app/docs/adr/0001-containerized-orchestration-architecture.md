# ADR 0001: Containerized Orchestration Architecture

- **Status:** Accepted — 2026-06-24
- **Deciders:** EliteFlow Nebula core team
- **Supersedes:** The previous file-based system (CSV tables + per-persona interactive Claude/Antigravity chats)

---

## Context

EliteFlow Nebula v1 coordinated a team of AI "persona" agents to perform software work
using a **file-based design**: structured state lived in CSV tables, persona identity and
process lived in markdown, and each persona was run as an independent, **interactive**
Claude or Antigravity chat session. A human operator effectively played the role of
orchestrator — opening the right chat, pasting context, copying results back into CSVs,
and answering each permission prompt by hand.

This worked as a proof of concept but does not scale and is not operable unattended:

- **No automation surface.** Every cycle required a human to drive sessions and shuttle
  state between chats and CSVs.
- **No durable, queryable state.** CSV files are hard to query, update transactionally,
  or expose to a UI; concurrent edits corrupt them.
- **Interactive permission prompts block progress.** A scheduled run cannot pause for a
  human to click "approve" — it simply stalls.
- **No resumability.** If a chat session died mid-task, there was no engine to resume
  from a known-good checkpoint; work was lost or silently inconsistent.

We are rebuilding as **EliteFlow Nebula v2**: a containerized service that orchestrates the
same persona team through a single conductor-driven pipeline. Seven product requirements
drive the rebuild:

1. A **web-based UI** for the service.
2. Move structured data from CSV files to a **relational database (Postgres)**.
3. Personas still execute their **written work instructions** — the process is unchanged.
4. Scheduled tasks/workflows are modeled as **atomic "work-cycles"**.
5. **"Mensa Nebula"** is the orchestrator that delegates dispatched tasks: it triggers an
   assignee, waits for that assignee's feedback, then triggers the next assignee.
6. Scheduled tasks **must not pop up for permission/access**. Permissions are
   pre-authorized; any question that arises during a run is written to a report/inbox
   instead of blocking the run.
7. A **batch-file installer** that prompts for required information and runs
   `docker compose`.

This ADR records the three architecture decisions at the heart of v2 and their
consequences.

---

## Decision

We adopt a **containerized, conductor-driven pipeline** built around three locked
decisions (A, B, C below). The system runs as four Docker Compose services
(`postgres`, `orchestrator`, `web`, `migrate`), with persona process/identity kept as
mounted, version-controlled files and all transactional state in Postgres.

### Decision A — Hybrid orchestrator (deterministic engine + LLM at decision points)

A **deterministic engine** (plain code, not an LLM) owns the work-cycle. It performs the
sequencing, state, and control-flow concerns:

> pick next ready task → spawn the assignee → await the structured result → persist state
> → trigger the next → commit.

The engine is **idempotent and resumable** across container restarts: a partially
completed work-cycle can be reopened and continued from durable state without
re-executing already-committed steps.

**"Mensa Nebula" is an LLM persona invoked only at decision points**, not for the loop
itself. It is consulted for:

- **Planning** the dispatch order for a cycle, and
- **Routing on feedback** — e.g. "Coeus rejected the diff → re-assign to Hephaestus with
  notes" versus "escalate."

**Rationale.** If the orchestration loop itself were an LLM chat, every LLM failure mode —
state loss, drift, mid-run death with no resume — would become an *orchestration* failure.
Sequencing, state, and retries must be deterministic so that the system is operable and
recoverable. The LLM is used where judgment genuinely helps (planning, routing) and kept
out of where determinism is mandatory (the control loop).

**Alternatives considered.**

- **Pure-LLM Mensa orchestrator.** A single LLM "conductor" owns the whole loop, deciding
  what to run next and tracking state in its own context. *Simpler to start; rejected as
  fragile* — non-deterministic sequencing, no reliable resume, and context loss on
  restart make it unfit for unattended scheduled runs.
- **Fully static pipeline (no LLM in orchestration at all).** Hard-coded routing only.
  Rejected because feedback routing (reject → reassign vs. escalate) and dispatch
  planning genuinely benefit from judgment; a static table cannot capture them well.

### Decision B — Claude Code headless is the sole automated execution backend

Each persona runs as a **non-interactive Claude Code invocation**:

```bash
claude -p "<task context>" \
  --output-format json \
  --allowedTools <allow-list> \
  --permission-prompt-tool <custom-mcp-permission-tool>
```

**Antigravity (a desktop IDE) has no headless CLI and cannot run in the orchestration
loop.** It remains an optional **manual/developer surface only**. The worker layer is
abstracted behind a backend interface so that another execution backend could be added
later without changing the engine.

**Rationale.** We need one purpose-built backend that supports non-interactive runs,
structured JSON output, tool allow-lists, and a pluggable permission-prompt hook. Claude
Code headless provides exactly this; Antigravity does not.

**Alternatives considered.**

- **Antigravity in the loop.** Rejected: no headless CLI, so it cannot be driven
  unattended.
- **Multiple automated backends from day one.** Rejected as premature; we ship one backend
  behind an abstraction and add others only when a concrete need appears.

### Decision C — Instructions stay as mounted, version-controlled files

The `instruction/` and `persona/*.md` files (process and identity) **remain git-tracked
files**, mounted **read-only** into the orchestrator container. Postgres replaces **only**
the structured/transactional CSV data and adds new runtime tables.

**Rationale.** This preserves the existing single-source-of-truth split — *tabular data →
database, narrative process → markdown*. Keeping process in git retains history and
diffing of process changes and avoids coupling routine process edits to database
migrations. Mounting read-only guarantees a worker cannot mutate its own instructions
mid-run.

**Alternatives considered.**

- **Move instructions into Postgres too.** Rejected: loses git history/diffing, couples
  every process tweak to a DB migration, and offers no real upside for narrative content.
- **Bake instructions into the image.** Rejected: every process edit would require an
  image rebuild and redeploy.

---

## Permission and question model (requirement #6)

No interactive permission popup may ever occur during a scheduled cycle. This is enforced
in two layers:

1. **Pre-authorization via allow-list.** Claude Code `settings.json`
   `permissions.allow` pre-authorizes the in-scope tools and paths a persona needs.
2. **A custom `--permission-prompt-tool` (MCP).** It intercepts anything **not** already
   pre-authorized and:
   - **Auto-approves** requests that fall within the persona's pre-authorized scope (the
     `permissions` table), and
   - For anything out of scope, **writes a row to the `questions` table** (the async
     inbox) and **denies-without-blocking** — the run continues and finishes rather than
     hanging on a prompt.

Questions surface in the web UI for a human to answer asynchronously. The cycle never
stalls waiting for input.

---

## The atomic work-cycle

Scheduled workflows are modeled as atomic work-cycles. The engine loop:

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

Each `task_run` is the **structured "feedback"** Mensa waits on before routing. Opening and
closing a work-cycle are durable, so a cycle interrupted by a container restart is
reopened and resumed rather than restarted.

---

## Consequences

### Positive

- **Operable unattended.** Cron-fired cycles run end to end with no human in the loop;
  questions are captured asynchronously instead of blocking.
- **Recoverable.** A deterministic, idempotent engine with durable work-cycle state
  survives container restarts and resumes cleanly.
- **Queryable, concurrent-safe state.** Postgres replaces fragile CSVs and powers the web
  UI and audit timeline.
- **Process stays in git.** Instructions remain diffable, reviewable, and decoupled from
  DB migrations.
- **Judgment where it helps, determinism where it must.** Mensa adds planning/routing
  intelligence without making the control loop non-deterministic.

### Negative / costs

- **Token cost scales with cycle size.** A cycle of N persona runs costs N invocations;
  cycles must cap work per run to bound cost.
- **In-container auth constraint.** The unattended container cannot perform the interactive
  OAuth browser popup at run time, so auth uses an env-var credential: either
  `CLAUDE_CODE_OAUTH_TOKEN` (minted once via `claude setup-token`, uses a Claude
  subscription) or `ANTHROPIC_API_KEY` (Console, per-token). The browser login is not
  eliminated — it just happens once up front to mint the token.
- **Single automated backend (for now).** Antigravity and other tools are out of the
  automated loop until a backend adapter is written.
- **Added moving parts.** Four containers, a custom permission MCP tool, and an ETL step
  add operational surface compared with editing CSVs by hand.

---

## Phasing

Delivery is sequenced to de-risk early and ship value incrementally:

1. **Headless runner + permission/question model on CSVs.** Prove non-interactive
   execution and the no-block question inbox against the existing CSV data.
2. **Postgres + CSV→DB ETL.** Stand up the schema and migrate/seed from the CSVs.
3. **Work-cycle engine + Mensa planner/router.** The deterministic loop plus LLM decision
   points.
4. **Web UI.** Read-only views first, then controls (trigger cycle, answer questions).
5. **Installer + hardening.** Batch-file installer, secrets handling, rate-limit and cost
   controls.

---

## Risks

| Risk | Mitigation |
|---|---|
| **In-container auth** — no interactive popup at run time | Supply an env-var credential: `CLAUDE_CODE_OAUTH_TOKEN` (subscription, minted once) or `ANTHROPIC_API_KEY` (per-token) |
| **Token cost of N-run cycles** | Cap work per cycle; bound retries; surface cost per `task_run` |
| **Determinism** | Engine is non-LLM; Mensa is consulted only at planning/routing decision points |
| **Secrets handling** | `.env` / docker secrets; never bake credentials into the image |
| **Long-running cycles vs. container limits** | Make cycles resumable; checkpoint and reopen across restarts |
| **API rate limits** | Throttle concurrency; back off and retry; record failures as run state |
