# Next-Life Report → Regent Systemo
**From:** Regent Systemo (this life) · **Date:** 2026-06-25
**Subject:** The system reorganization is COMPLETE — Phases 1, 2, 3 landed on top of Phase 0

Welcome back, Regent. Read this once, then archive it to
`regent-systemo/archive/next-life-report.<YYYY-MM-DD-HHMM>.md` so it is consumed once.

---

## 0. Headline
The 2026-06 reorganization (ADR-0002, decisions D1–D5) is **fully implemented**. The previous
life left Phase 0 done; this life built **Phase 1 (medium/gateway), Phase 2 (monitor-only
dashboard), and Phase 3 (Electron installer + control panel)**. All work is committed on
branch `reorg/phase-0` and is **NOT pushed** (founder's standing rule: don't push unless
asked). The founder declined a push this session; offer it next time if appropriate.

## 1. What EliteFlow Nebula is (unchanged)
A containerized service: **business idea → requirements → planning → tasks → builds the
selected project** (product lands in `product/`). A deterministic engine runs atomic
**work-cycles**; each persona is a headless **Claude Code** worker; **Mensa Nebula** plans/
routes. *You* develop the **platform** (`app/`), not the downstream products. You are the
**external steward/medium** living in `regent-systemo/` (outside the service roster). Read,
every life: `app/README.md`, `app/docs/architecture.md`, ADR-0001, ADR-0002,
`app/docs/user-guide.md`, then your identity + role skill.

## 2. Branch `reorg/phase-0` — commits on top of `main` HEAD `65a1518`
Phase 0 (previous life): `707718d` atomic Mensa cycles · `3be476a` ADR-0002 + doc reframe.
This life (6 commits):
- `362ce53` feat(medium): persona router + conversational runner + signed relay (C, Phase 1)
- `0806e25` feat(mensa): opt-in LLM-Mensa cycle planning on the persona runner (C6, Phase 1)
- `a0edeb1` docs(adr-0002): mark Phase 1 done
- `ae360e9` feat(web): monitor-only dashboard; retire planning console + credential page (D, Phase 2)
- `daaa48a` feat(installer): scaffold Electron GUI installer + tested core (D4, Phase 3)
- `099792b` feat(installer): setup wizard + control panel; retire .bat scripts (D4, Phase 3)

Working tree is clean. `npm run typecheck` + `npm run build -w @elliteflow/web` were green at each step.

## 3. What each phase delivered (so you know the system)

### Phase 1 — Workstream C: the medium/gateway (ADR-0002 D2 + the D5 Mensa seam)
The founder's single front door. **You (this CLI) are the conversational front-end**: drive it with
`npm run medium -- "<message>"` (or `--session <id>` / `MEDIUM_SESSION` env to continue a thread).
Lives in `services/orchestrator/`:
- `persona-chat.ts` — conversational runner for **any** persona (per-persona tool scope via
  `TOOL_SCOPE`, currently empty = no tools; stateless turns via history replay; dry-run aware).
  Has an optional `operatingMode` so the same runner serves both the medium and Mensa planning.
- `router.ts` — deterministic **role/keyword map** → resolved to a live active persona, with an
  **executive-consultant fallback**. *(LLM router is a documented later seam — replace `scoreRoles`.)*
- `medium.ts` — orchestrates request → route → run → **sign `— Name, Role`** → log to
  `chat_messages` + an `events` audit trail (`medium.request|route|reply`, `cycle_id = NULL`).
- `medium-cli.ts` — the CLI front (`npm run medium`).
- `claude-headless.ts` — shared credential + envelope parsing (worker.ts reuses it).
- `mensa-plan.ts` — **opt-in** LLM-Mensa cycle planning behind `MENSA_PLANNING` (off by default).
  `mensa.ts plan()` does the deterministic dispatch read, then `orderViaMensa` reorders via the
  persona runner; falls back to deterministic on disabled/no-schedule/<2 items/dry-run/parse-fail.
- Schema `006_medium.sql` — relaxed `chat_sessions.persona_id`, added `chat_sessions.kind`
  (`planning`|`medium`) and per-message `chat_messages.persona_id` attribution.

### Phase 2 — Workstream D: monitor-only dashboard (ADR-0002 D3)
`apps/web/` is now **read-only**. **Removed:** the `/chat` planning console, `/api/chat`, the web
`chat-runner.ts`, `planning-queries.ts`, and the `/setup` + `/api/credential` Connect-Claude page
(+ the overview credential gate). **Added** (all read-only): `/board` (task/dispatch board via a
LATERAL join), `/activity` (per-persona activity + spend + the event timeline), `/medium`
(read-only viewer of the gateway threads), and a total-spend card on Overview. Queries in
`apps/web/lib/queries.ts`; shared `lib/format.ts`. **Consequence:** the credential is now env-var
only (`CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY`) — the GUI step returns via the installer.
`web/lib/chat-runner.ts` and `packages/db/src/planning-mcp.ts` are now superseded/orphaned (kept,
not deleted — the medium could grant planning tools to a persona later).

### Phase 3 — Workstream E: Electron installer + control panel (ADR-0002 D4)
`app/installer/` — a **standalone package, NOT a root workspace** (Electron's binary would bloat
every core install; see the memory note). `core.ts` is pure/tested logic (`.env` generation with
`APP_SECRET` reuse + `ANTIGRAVITY_TOKEN`, `configFromEnv` update-prefill, `composeArgs` for the
keep-vs-clean branch, `extractClaudeToken`). `main.ts` is the IPC/child_process shell; `preload.ts`
the typed bridge; `public/` the wizard + control-panel renderer. Wizard: mode (fresh/update +
app-folder detection) → config → credential (live `claude setup-token` spawn-capture + paste
fallback; optional Antigravity token) → data (keep/clean) → write `.env` + streamed
`docker compose up -d --build`. Control panel: start/stop/clean/dashboard/logs. NSIS via
`electron-builder.yml`. The `install.bat`/`start.bat`/`stop.bat` scripts were **retired**;
`install.sh` remains as the POSIX/headless fallback.

## 4. What REMAINS (none blocking; pick up on demand)
1. **On-Windows verification of the installer** — GUI click-through + the NSIS `.exe`
   (`cd installer && npm install && npm run dist`). **Could not be done in the dev sandbox**: the
   Electron *binary* download is blocked there (the npm package + types install fine, so
   `tsc`/build + the 39 core unit tests pass). This is the one real open item.
2. **Remote-Docker** — the documented fast-follow to local-Docker (D4). Not started.
3. **Deferred seams (safe, documented):** the LLM router in `router.ts` (keyword map is live);
   live `MENSA_PLANNING` reorder (opt-in, never verified against a real LLM — needs a credential);
   and the **seed-hardening** task flagged back in Phase 0 (per-table try/catch in `seed.ts`).

## 5. Gotchas / lessons (some carried from the prior life)
- **`workspace/` is NOT under git** (only `app/` is). Archive a backup before editing any
  `workspace/**` CSV. Your home `regent-systemo/` is also outside git.
- **Installer is standalone:** don't add `installer/` to root `workspaces`; typecheck it
  separately (`cd installer && npx tsc --noEmit`). Electron binary download is blocked in the
  sandbox → verify GUI/packaging on a Windows host.
- **npm root-proxy swallows `--flags`** through the double hop (root → workspace). For CLI
  entry points use an **env var** (that's why `medium-cli.ts` reads `MEDIUM_SESSION`). Both
  lessons are saved in your auto-memory (`MEMORY.md`).
- **`MENSA_PLANNING` / dry-run:** the medium and Mensa planning are dry-run aware — dry-run
  yields synthetic replies and skips the LLM, so the engine/medium can be exercised for free.
- **`APP_SECRET` must stay stable** (signs sessions + derives the credential-encryption key).
  The installer + install.sh both preserve it across re-installs.
- **CRLF/LF** "LF will be replaced by CRLF" git warnings are noise.
- Brand strings still say "ElliteFlow"/`@elliteflow` (double-l) while the folder is `eliteflow`;
  a full rebrand remains intentionally out of scope.

## 6. Your first actions next life
1. Boot per `regent-systemo/initial-prompt.md`; read the app docs + ADR-0002 + this report; archive this file.
2. `cd app && npm install` (repairs the `@elliteflow/*` symlinks), then `npm run typecheck` to confirm health.
3. Ask the founder what's next. Likely candidates: push `reorg/phase-0` (and/or open a PR);
   on-Windows installer verification; remote-Docker; or one of the deferred seams in §4.
   The reorg itself is **done** — this is now steady-state platform stewardship + on-demand work.

— *Regent Systemo, System Steward & API Gateway*
