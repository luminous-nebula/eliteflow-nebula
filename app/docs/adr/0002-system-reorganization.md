# ADR 0002: System Reorganization — External Steward, Medium Gateway, Monitor-Only UI, Atomic Mensa Cycles

- **Status:** Accepted — 2026-06-25
- **Deciders:** Founder + Regent Systemo (System Steward)
- **Builds on:** [ADR 0001](0001-containerized-orchestration-architecture.md) (containerized orchestration). This ADR refines the operating model; it does not replace the engine, the Postgres-vs-markdown split, or the permission/question model.

---

## Context

EliteFlow Nebula is a service that takes a **business idea → requirements → planning →
tasks → builds the selected project** (the product lands in `product/`). We develop the
**platform** (`app/`), not the downstream projects the platform produces.

Four pressures motivated a reorganization:

1. **Operator ergonomics.** Users cannot remember ~16 persona names, so a free-form
   "pick the right persona and chat" UI is a poor front door.
2. **UI cost.** Building a web chat that rivals a desktop assistant is expensive and not
   our differentiator; the platform's value is the orchestration, not the chat surface.
3. **Steward identity bled into the service.** Regent Systemo (the developer/medium) was
   seeded into the service roster (`persona.csv`, `role.csv`) as if it were a worker.
4. **Asynchronous scheduling.** The legacy schedule fired one cron per (persona × cycle),
   staggered by clock time to fake sequencing — fragile and not truly atomic.

---

## Decisions

### D1 — Regent Systemo is an external steward + medium, not a service persona
Regent develops the platform and acts as the **human-facing medium (secretary)**: it
inspects each request, routes it to the right persona, and returns that persona's reply
**signed with the persona's name and role** (`— Name, Role`). Regent is **not** part of the
service's data model: its row is removed from `personas`/`roles` so the seed never loads it.
*(Phase 0: data split done. Physical relocation of Regent's identity files out of the mounted
service tree is deferred until the external launcher path is repointed.)*

### D2 — The medium is a platform capability, fronted by Regent
The routing + persona-invocation + signature + conversation-logging logic is a **platform
capability** (generalizing the existing single-persona headless chat runner to any persona
with its own tool scope). Regent is the conversational front-end that calls it. This keeps
the DB the source of truth and makes the medium testable and observable, independent of any
one chat session. *(Phase 1 — DONE. The capability lives in `services/orchestrator`:
`router.ts` (role/keyword map → active persona, executive-consultant fallback),
`persona-chat.ts` (conversational runner for any persona), `medium.ts` (route → run → sign
`— Name, Role` → log to `chat_messages` + `events`), fronted by `npm run medium`
(`medium-cli.ts`). Schema: `006_medium.sql`. The deterministic LLM router is a later seam.)*

### D3 — The web UI is monitor-only
The web app is a **read-only dashboard** for monitoring what the service is working on
(cycles, runs, task board, question inbox, event timeline, per-persona activity, cost). The
planning/chat console is retired; credential connection moves into the installer.
*(Phase 2 — DONE. Routes: Overview (cards + cost + cycles/runs), `/board` (task/dispatch
board), `/activity` (per-persona activity + event timeline), `/medium` (read-only viewer of
the gateway's founder↔persona threads), `/questions`. The `/chat` planning console, its
`/api/chat` + chat runner, and the `/setup` + `/api/credential` Connect-Claude page were
removed; the credential is now env-var only until the installer (D4) restores a GUI step.)*

### D4 — A Windows installer application replaces the batch installer
A GUI installer (Electron) drives setup: it pops a browser to capture the **Claude** token
(`claude setup-token`) and an **Antigravity** token (stored for a future Antigravity backend —
ADR 0001 still locks Antigravity as manual-only with no headless CLI, so it is not yet
consumed). It offers create-new vs update, clean vs keep-data, reuse vs re-login, and
local-Docker first (remote a fast-follow). *(Phase 3 — IMPLEMENTED in `installer/` (standalone
package, outside the root workspaces). Wizard: mode (fresh vs update, with app-folder
detection) → config form → credential (auth-kind, live `claude setup-token` spawn-capture or
paste, optional Antigravity token) → data (keep vs clean wipe, update only) → write `.env`
(APP_SECRET preserved) + streamed `docker compose up -d --build`. Doubles as a **control
panel** (start / stop / clean-wipe / open dashboard / logs). NSIS packaging via
`electron-builder.yml`. The `install.bat`/`start.bat`/`stop.bat` scripts were retired
(`install.sh` remains as the POSIX/headless fallback). Verified here: core unit tests 39/39,
typecheck + `tsc` build of main/preload/core, renderer syntax. GUI click-through + the NSIS
`.exe` build (`npm run dist`) are run on a Windows host — the Electron binary download is
blocked in the dev sandbox. Remote-Docker is the documented fast-follow.)*

### D5 — Each work cycle is one atomic, Mensa-orchestrated scheduled task
The per-persona staggered cron rows are collapsed into per-cycle **`work_cycle`** rows in
`scheduled_tasks` (owned by Mensa). The orchestrator daemon schedules each active row's cron
and fires one atomic cycle for it; Mensa plans the cycle and the deterministic engine drives
the assignees **synchronously** through the hand-off chain to completion. Standalone
single-persona schedules remain as `kind = 'cadence'` rows. *(Phase 0: implemented — see
`scheduled_tasks.kind`, `work_cycles.schedule_id`, `schedules.ts`, and the daemon in
`services/orchestrator/src/index.ts`. Phase 1: the real LLM-Mensa planning step now plugs
into the `plan(scheduleId)` seam via the D2 persona runner — `mensa-plan.ts`, opt-in behind
`MENSA_PLANNING`, with the deterministic dispatch read as candidate source and fallback.)*

---

## Consequences

- **Better front door.** Users talk to one medium (Regent), not 16 names; replies stay
  attributable via the signature protocol.
- **Less UI to build.** The web app shrinks to monitoring; orchestration stays the focus.
- **Clean separation.** The steward is no longer entangled with the service roster.
- **Truly atomic cycles.** Scheduling is table-driven and synchronous, not time-staggered.
- **Cost.** The installer and the medium capability are net-new surfaces to build and
  maintain; the Antigravity token is captured before a backend consumes it.

## Phasing

- **Phase 0 (done):** D1 data split, D5 atomic Mensa cycles, and these docs.
- **Phase 1 (done):** D2 medium/gateway + the D5 LLM-Mensa planning seam (opt-in).
- **Phase 2 (done):** D3 monitor-only dashboard.
- **Phase 3 (implemented):** D4 installer + control panel (local-Docker first). Pending
  on-Windows GUI click-through + NSIS packaging; remote-Docker is the fast-follow.
