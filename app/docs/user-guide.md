# EliteFlow Nebula — User & Testing Guide

This guide walks you from a clean machine to a running EliteFlow Nebula instance, then
through a safe, step‑by‑step **test** of every moving part: install → first‑run login →
seed the database → run a work‑cycle → inspect results on the monitor dashboard → exercise
the question inbox. A **dry‑run mode** lets you validate the whole engine **without spending
any Claude tokens** (and without a credential at all).

> New to the design? Skim [`architecture.md`](architecture.md) first. This guide assumes the
> folder layout `eliteflow-nebula/{app,workspace,product}` (you run everything from `app/`).

---

## 0. What you are testing

```
eliteflow-nebula/
├── app/        ← the application you run (this repo)
├── workspace/  ← instruction/, persona/, database/ CSVs  (seed source + mounted process files)
└── product/    ← the code the personas generate/edit     (starts empty)
```

Four containers come up: **postgres** (data), **migrate** (one‑shot: schema + seed), **orchestrator**
(the engine + Claude Code), **web** (the dashboard). You drive it from the dashboard and the CLI.

---

## 1. Prerequisites

| Need | Why | Check |
|---|---|---|
| **Docker Desktop**, running | Builds and runs the four services | `docker compose version` |
| **A populated `workspace/`** | Seeds the DB; mounted for personas | `ls ../workspace/database` shows CSVs |
| **A Claude credential** *(optional for the dry‑run test)* | Real runs call Claude Code | see step 4 |
| Node 22+ *(only for the local loop in Appendix A)* | Run without building images | `node -v` |

> The credential is **not** needed for the dry‑run smoke test (§6). You only need it for a
> real work‑cycle (§8).

---

## 2. Install (Docker)

**Windows — GUI installer (primary).** Build and launch the Electron installer:

```sh
cd installer && npm install && npm run dist   # → release/*.exe, double-click to run
```

The wizard collects the same settings, captures the Claude credential (browser
`claude setup-token`), writes `.env`, and starts the stack. Afterwards it stays open as a
**control panel** (start / stop / clean-wipe / open dashboard / logs). See
`installer/README.md`.

**POSIX / headless fallback.** From `eliteflow-nebula/app`:

```sh
./install.sh
```

Accept the bracketed defaults unless you have a reason not to:

- **Workspace path** → `../workspace`  ·  **Product repo** → `../product`
- **Auth method** → for a first dry‑run test you can leave the credential blank (dry-run
  needs none, §6); set a real one later for §8.
- **Database password**, **Web UI port** (default `3000`), **Timezone**.
- **Work‑cycle cron** → for controlled testing, enter a **blank** value so cycles only run
  when you trigger them (you can change `CYCLE_CRON` in `.env` later).

Either path writes `.env`, generates a random `APP_SECRET`, then runs
`docker compose up -d --build` and seeds the database.

**Verify the stack is up:**
```sh
docker compose -f infra/docker-compose.yml ps
```
Expect `postgres`, `orchestrator`, `web` = *running*, and `migrate` = *exited (0)* (it runs once).

```sh
docker compose -f infra/docker-compose.yml logs migrate | tail -20   # should end "Seed complete."
```

---

## 3. Confirm the seed

```sh
docker compose -f infra/docker-compose.yml exec postgres \
  psql -U agentflow -d agentflow -c "SELECT count(*) FROM personas;"
```
Expect **17** personas. Also try `FROM tasks` (~173) and `FROM teams` (4). If these return
rows, the CSV→Postgres seed worked.

---

## 4. First run in the browser

Open **http://localhost:3000** (or your chosen port).

**Set an operator password** — first visit shows *Create operator password* (min 8 chars).
This protects the monitor dashboard. After this you are signed in and land on **Overview**.

The dashboard is **monitor-only** (ADR-0002 D3) — Overview, **Board**, **Activity**,
**Medium**, and **Questions**. It shows what the service is doing; it does not drive work.

**The Claude credential is set out-of-band**, not in the browser (the in-app Connect-Claude
page was retired with the planning console; a GUI step returns with the installer):
- **Dry-run (§6) needs no credential at all** — skip ahead.
- **Real runs (§8)** read `CLAUDE_CODE_OAUTH_TOKEN` (mint once with `claude setup-token`) or
  `ANTHROPIC_API_KEY` from `.env`. Set one, then `docker compose ... up -d orchestrator`.

---

## 5. Make sure there is work to run

Most seeded dispatch rows are already `done`, so a fresh cycle may find nothing. Insert one
guaranteed‑runnable task + dispatch so the test cycle does something (and exercises the
**engineer → reviewer** hand‑off):

```sh
docker compose -f infra/docker-compose.yml exec postgres psql -U agentflow -d agentflow -c "
  INSERT INTO tasks (task_id, task_name, status, auto)
  VALUES ('TEST-001','Smoke-test task','planned',true)
  ON CONFLICT (task_id) DO UPDATE SET status='planned', auto=true;
  INSERT INTO dispatch (cycle_no, task_id, assignee_persona_id, instructions, status)
  VALUES (1,'TEST-001','hephaestus-nebula','Smoke test - do nothing real','pending');
"
```

---

## 6. Smoke test: run a work‑cycle in **dry‑run** (no tokens spent)

Dry‑run makes each persona worker return a synthetic "done" report instead of invoking
Claude — so the full engine path (plan → run → persist → route → close) runs for free.

```sh
docker compose -f infra/docker-compose.yml exec -e ORCHESTRATOR_DRY_RUN=1 \
  orchestrator npm run run-cycle
```

Watch the log lines: you should see a cycle open, a run for **Hephaestus** on `TEST-001`,
then a routed run for **Coeus** (the reviewer), then the cycle close with **2 runs**.

**Verify in the UI:** refresh **Overview** →
- a new row under **Recent work‑cycles** (`completed`, 2 runs),
- two rows under **Recent runs** (hephaestus‑nebula, then coeus‑nebula), both `done`,
- `TEST-001` now shows status `review` under **Tasks by status**.

**Verify in the DB (optional):**
```sh
docker compose -f infra/docker-compose.yml exec postgres psql -U agentflow -d agentflow -c "
  SELECT id, status, trigger FROM work_cycles ORDER BY id DESC LIMIT 3;
  SELECT persona_id, role, status FROM task_runs ORDER BY id DESC LIMIT 3;
"
```

✅ If you see the cycle and two runs, the **engine, planner, router, persistence, and
permission plumbing are all working**.

---

## 7. Test the question inbox

Questions raised during a run land in an inbox instead of blocking. Simulate one, then
resolve it from the UI:

```sh
docker compose -f infra/docker-compose.yml exec postgres psql -U agentflow -d agentflow -c "
  INSERT INTO questions (persona_id, question, context, blocking)
  VALUES ('hephaestus-nebula','Which database should the test app use?','raised during smoke test', false);
"
```
- Open **Question inbox** (top nav) — the question appears, attributed to the persona.
- Type an answer and click **Resolve** — it disappears and the **Open questions** count on
  Overview drops. (Under the hood `status` flips to `answered` with your text + timestamp.)

✅ The async permission/question model works end‑to‑end.

---

## 8. Optional: a real work‑cycle (spends tokens)

Only after a real credential is connected (§4) **and** `product/` contains a repo the
personas can edit. Then either let the cron fire, or trigger one cycle:

```sh
docker compose -f infra/docker-compose.yml exec orchestrator npm run run-cycle
```
This invokes Claude Code headless for each dispatched persona, editing the mounted
`product/` repo. Watch `docker compose ... logs -f orchestrator`. Expect real latency and
token cost. Start with a **single** small dispatched task.

---

## 9. Everyday operations

```sh
# follow orchestrator logs
docker compose -f infra/docker-compose.yml logs -f orchestrator

# restart just the orchestrator after editing .env
docker compose -f infra/docker-compose.yml up -d orchestrator

# stop everything (keeps the database volume)
docker compose -f infra/docker-compose.yml down

# stop AND wipe the database (next 'up' re-migrates + re-seeds from workspace/)
docker compose -f infra/docker-compose.yml down -v
```

Turn scheduled cycles on/off by setting `CYCLE_CRON` in `.env` (e.g. `*/30 * * * *`, or blank
for on‑demand only) and restarting the orchestrator.

---

## 10. "It passes" checklist

- [ ] `docker compose ps` — postgres/orchestrator/web running, migrate exited 0
- [ ] `SELECT count(*) FROM personas` returns 17 (seed worked)
- [ ] Browser: set operator password → Overview loads (monitor-only; no credential needed)
- [ ] Dry‑run cycle produces a `completed` work‑cycle with 2 runs (engineer → reviewer)
- [ ] `TEST-001` moves to `review`
- [ ] Inbox: a question appears and can be resolved

---

## 11. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `invalid spec: :/workspace: empty section between colons` (+ "variable is not set" warnings) | No `.env` file. You ran `docker compose up` directly — the vars come from `.env`, which the **installer creates**. Run the GUI installer (or `install.sh`) first; afterwards start/stop from the installer's control panel. |
| `docker compose` errors at install | Docker Desktop not running. Start it, then retry from the installer. |
| Port already in use | Another service on `3000`/`5432`. Set `WEB_PORT` / `POSTGRES_PORT` in `.env`, `up -d` again. |
| `migrate` exited non‑zero | Check `logs migrate`. Usually a workspace CSV is missing/empty — confirm `../workspace/database/**` is populated. |
| Overview shows `$0.00` / no runs | Nothing has run yet, or no credential for real runs. Dry‑run (§6) populates the dashboard without a credential. |
| Dry‑run cycle reports **0 runs** | No runnable dispatch. Re‑run the §5 SQL (its `status` may already be `review` from a prior run — the `ON CONFLICT` resets it to `planned`; also reset the dispatch row to `status='pending'`). |
| Real run fails to auth | Credential invalid/expired/missing. Set `CLAUDE_CODE_OAUTH_TOKEN` (`claude setup-token`) or `ANTHROPIC_API_KEY` in `.env`, then restart the orchestrator. The in-app credential page was retired (ADR-0002 D3). |
| Changed `APP_SECRET` and now can't sign in / decrypt | The secret must stay stable. Restore it, or `down -v` and start fresh. |

---

## Appendix A — Fast local loop (no Docker images)

For quick engine iteration you can run the Node code directly against a local Postgres.
Commands shown for **PowerShell** (your default shell).

```powershell
# 1. A throwaway Postgres (or use your own)
docker run -d --name eliteflow-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17

# 2. Environment  (SEED_DB_PATH must be absolute — npm runs scripts from the package dir)
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:5432/postgres"
$env:APP_SECRET   = "local-dev-secret-change-me"
$env:SEED_DB_PATH = (Resolve-Path "..\workspace\database").Path

# 3. Install, migrate, seed
npm install
npm run migrate
npm run seed

# 4. Run one cycle in dry-run, then start the dashboard
$env:ORCHESTRATOR_DRY_RUN = "1"
npm run run-cycle
npm run web        # http://localhost:3000
```

Apply the §5 SQL via `psql` (or any client) against `localhost:5432` before running the
cycle if you want guaranteed work. Tear the DB down with `docker rm -f eliteflow-pg`.
