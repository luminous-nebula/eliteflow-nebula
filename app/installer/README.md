# EliteFlow Nebula — GUI Installer (Electron)

The Windows GUI installer from **ADR-0002 D4** — it replaces the `install.bat` flow with a
wizard that collects config, captures the Claude credential, writes `.env`, and drives
`docker compose` (local-Docker first; remote a fast-follow).

> **Status: implemented; on-Windows verification pending.** The wizard (mode → config →
> credential → data → run), the control panel (start/stop/clean/dashboard/logs), the live
> `claude setup-token` spawn-capture, and NSIS packaging config are all in place. The core
> logic is unit-tested and the TypeScript compiles, but the GUI click-through and the `.exe`
> build run on a Windows host — the Electron binary download is blocked in the dev sandbox.

## Layout

```
installer/
├── src/
│   ├── core.ts       # pure logic: buildEnvContent, extractAppSecret, composeArgs, validate
│   ├── main.ts       # Electron main process (window + IPC) — thin shell over core.ts
│   └── preload.ts    # contextBridge API exposed to the renderer (no Node in renderer)
├── public/
│   ├── index.html    # renderer UI (scaffold placeholder)
│   └── renderer.js   # renderer logic (plain JS; talks only via window.installer)
├── test/core.test.ts # unit tests for the core logic (run with tsx, no display needed)
├── electron-builder.yml
├── tsconfig.json
└── package.json
```

This is a **standalone package**, deliberately *not* in the root npm workspaces — Electron's
binary is large and would bloat every core `npm install`. Install it on its own.

## Develop / build / package (on a Windows machine with Docker Desktop)

```sh
cd installer
npm install            # fetches Electron's binary (blocked in some sandboxes)
npm test               # core logic unit tests
npm run build          # tsc → dist/ (main.js, preload.js, core.js)
npm start              # build + launch the Electron window
npm run dist           # build + electron-builder → release/ (NSIS .exe)
```

`npm run dist` produces a double-clickable Windows installer under `release/`.

## Design (locked in core; wired in the wizard increment)

- **`.env` parity with `install.bat`** — same keys, same `APP_SECRET` reuse rule (a
  re-install preserves it, or stored credentials become undecryptable). Plus
  `ANTIGRAVITY_TOKEN`, captured for a future Antigravity backend (ADR-0001 keeps Antigravity
  manual-only, so nothing consumes it yet).
- **Lifecycle branches (ADR-0002 D4)** — `composeArgs` covers create/update (`up -d --build`),
  start (`up -d`), stop keeping data (`down`), and clean wipe (`down -v`). The fresh-vs-update
  branch (with app-folder detection) and the keep-vs-clean data branch are wired in the wizard;
  the control panel reuses the same actions.
- **Credential capture** — the credential screen spawns `claude setup-token` (browser OAuth)
  and parses the printed token (with a manual-paste fallback), or takes an API key. An
  optional Antigravity token is stored in `.env` for the future backend. A subscription
  (OAuth) install also writes `OAUTH_ONLY=true`, so the orchestrator refuses to start if a
  metered `ANTHROPIC_API_KEY` later slips into `.env`; API-key installs leave it blank.
- **Deployment target (local vs remote Docker)** — the config step chooses **Local Docker**
  (Docker Desktop) or **Remote Docker** over SSH. For remote, enter a `ssh://user@host`
  Docker host; the installer sets `DOCKER_HOST` on every `docker compose` it spawns (install,
  control-panel start/stop/clean/logs) and points **Open dashboard** at the remote host. The
  target + host persist to `.env` (`DEPLOY_TARGET`, `DOCKER_HOST`) so update-mode prefills
  them. **Caveat:** compose bind-mounts `WORKSPACE_PATH`/`SOURCE_REPO_PATH`, which resolve on
  the *remote* host — those folders must already exist there. Provision them first with
  [`infra/deploy-remote.sh`](../infra/deploy-remote.sh) (tars the data dirs over SSH); the GUI
  then drives the remote daemon and serves as its control panel.
