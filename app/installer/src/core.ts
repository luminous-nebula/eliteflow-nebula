import { randomBytes } from 'node:crypto';

/**
 * Installer core — pure, side-effect-light logic shared by the Electron main process.
 * Kept free of any `electron` import so it can be unit-tested without a display: the
 * GUI shell (main.ts) is a thin wrapper that calls these functions and child_process.
 *
 * This is the GUI replacement for the batch installer: it produces the same `.env` (as
 * install.sh) and drives the same `docker compose` lifecycle (ADR-0002 D4, local-Docker first).
 */

export type AuthKind = 'oauth_token' | 'api_key';

export interface InstallerConfig {
  projectName: string;
  timezone: string;
  workspacePath: string;   // resolved absolute path
  sourceRepoPath: string;  // resolved absolute path
  postgresUser: string;
  postgresPassword: string;
  postgresDb: string;
  postgresPort: string;    // host port mapping (internal stays 5432)
  webPort: string;
  claudeModel: string;
  cycleCron: string;       // blank = on-demand only
  maxRunsPerCycle: string;
  authKind: AuthKind;
  oauthToken: string;      // when authKind === 'oauth_token'
  apiKey: string;          // when authKind === 'api_key'
  /** Captured for a FUTURE Antigravity backend (ADR-0001 keeps Antigravity manual-only,
   *  so nothing consumes this yet). Stored in .env for when a backend lands. */
  antigravityToken: string;
  appSecret: string;       // reused across installs; generated only on first install
}

/** A fresh APP_SECRET: signs sessions AND derives the credential-encryption key, so it
 *  must stay stable across installs. 64 hex chars, matching install.bat's two-GUID value. */
export function generateAppSecret(): string {
  return randomBytes(32).toString('hex');
}

/** Sensible defaults for a fresh install (a new APP_SECRET is minted). */
export function defaultConfig(): InstallerConfig {
  return {
    projectName: 'EliteFlow Nebula',
    timezone: 'Asia/Bangkok',
    workspacePath: '',
    sourceRepoPath: '',
    postgresUser: 'agentflow',
    postgresPassword: 'change-me',
    postgresDb: 'agentflow',
    postgresPort: '5432',
    webPort: '3000',
    claudeModel: 'claude-opus-4-8',
    cycleCron: '*/30 * * * *',
    maxRunsPerCycle: '12',
    authKind: 'oauth_token',
    oauthToken: '',
    apiKey: '',
    antigravityToken: '',
    appSecret: generateAppSecret(),
  };
}

/** Parse a .env file's text into a flat key→value map (last write wins). */
export function parseEnv(envText: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of envText.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

/** Build an update-mode config by overlaying an existing .env onto the defaults. The
 *  auth kind is inferred from which credential the .env carries; APP_SECRET is preserved. */
export function configFromEnv(env: Record<string, string>, defaults = defaultConfig()): InstallerConfig {
  const filled = (k: string): boolean => typeof env[k] === 'string' && env[k] !== '';
  const authKind: AuthKind = filled('ANTHROPIC_API_KEY') && !filled('CLAUDE_CODE_OAUTH_TOKEN')
    ? 'api_key' : 'oauth_token';
  return {
    ...defaults,
    projectName: env.PROJECT_NAME ?? defaults.projectName,
    timezone: env.TIMEZONE ?? defaults.timezone,
    workspacePath: env.WORKSPACE_PATH ?? defaults.workspacePath,
    sourceRepoPath: env.SOURCE_REPO_PATH ?? defaults.sourceRepoPath,
    postgresUser: env.POSTGRES_USER ?? defaults.postgresUser,
    postgresPassword: env.POSTGRES_PASSWORD ?? defaults.postgresPassword,
    postgresDb: env.POSTGRES_DB ?? defaults.postgresDb,
    postgresPort: env.POSTGRES_PORT ?? defaults.postgresPort,
    webPort: env.WEB_PORT ?? defaults.webPort,
    claudeModel: env.CLAUDE_MODEL ?? defaults.claudeModel,
    cycleCron: env.CYCLE_CRON ?? defaults.cycleCron,
    maxRunsPerCycle: env.MAX_RUNS_PER_CYCLE ?? defaults.maxRunsPerCycle,
    authKind,
    oauthToken: env.CLAUDE_CODE_OAUTH_TOKEN ?? '',
    apiKey: env.ANTHROPIC_API_KEY ?? '',
    antigravityToken: env.ANTIGRAVITY_TOKEN ?? '',
    appSecret: env.APP_SECRET || defaults.appSecret,
  };
}

/** Best-effort extraction of the token from `claude setup-token` output: the last line
 *  that looks like a credential token (the CLI prints guidance, then the token). */
export function extractClaudeToken(output: string): string | null {
  const lines = output.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    // Tokens are long, no spaces; commonly prefixed sk-ant-oat... but accept any long opaque blob.
    if (!/\s/.test(line) && line.length >= 20 && /^[A-Za-z0-9._-]+$/.test(line)) return line;
  }
  return null;
}

/** Pull APP_SECRET out of an existing .env's text, so a re-install preserves it
 *  (regenerating it would make any stored Claude credential undecryptable). */
export function extractAppSecret(existingEnvText: string): string | null {
  for (const line of existingEnvText.split(/\r?\n/)) {
    const m = /^\s*APP_SECRET\s*=\s*(.*)$/.exec(line);
    if (m && m[1]!.trim()) return m[1]!.trim();
  }
  return null;
}

/** The internal connection string the app services use (compose service name + internal
 *  port 5432), independent of the host POSTGRES_PORT mapping. */
export function databaseUrl(c: InstallerConfig): string {
  return `postgres://${c.postgresUser}:${c.postgresPassword}@postgres:5432/${c.postgresDb}`;
}

/** Render the `.env` file contents. Mirrors install.sh's layout, plus ANTIGRAVITY_TOKEN. */
export function buildEnvContent(c: InstallerConfig): string {
  const lines = [
    `PROJECT_NAME=${c.projectName}`,
    `TIMEZONE=${c.timezone}`,
    `APP_SECRET=${c.appSecret}`,
    `POSTGRES_USER=${c.postgresUser}`,
    `POSTGRES_PASSWORD=${c.postgresPassword}`,
    `POSTGRES_DB=${c.postgresDb}`,
    `POSTGRES_PORT=${c.postgresPort}`,
    `DATABASE_URL=${databaseUrl(c)}`,
    `CLAUDE_CODE_OAUTH_TOKEN=${c.authKind === 'oauth_token' ? c.oauthToken : ''}`,
    `ANTHROPIC_API_KEY=${c.authKind === 'api_key' ? c.apiKey : ''}`,
    `CLAUDE_MODEL=${c.claudeModel}`,
    `WORKSPACE_PATH=${c.workspacePath}`,
    `SOURCE_REPO_PATH=${c.sourceRepoPath}`,
    `WEB_PORT=${c.webPort}`,
    `CYCLE_CRON=${c.cycleCron}`,
    `MAX_RUNS_PER_CYCLE=${c.maxRunsPerCycle}`,
    // Captured for a future Antigravity backend; unused by docker-compose today.
    `ANTIGRAVITY_TOKEN=${c.antigravityToken}`,
  ];
  return lines.join('\n') + '\n';
}

export type ComposeAction =
  | 'up'          // create/update + (re)build and start  → up -d --build
  | 'start'       // start existing stack                  → up -d
  | 'stop'        // stop, keep data                       → down
  | 'down-clean'; // stop AND wipe the database volume     → down -v

/** Build the `docker compose` argv for a lifecycle action against the compose file.
 *  Covers the clean-vs-keep-data branch (ADR-0002 D4): `stop` preserves the pgdata
 *  volume; `down-clean` removes it so the next `up` re-migrates and re-seeds. */
export function composeArgs(action: ComposeAction, composeFile: string): string[] {
  const base = ['compose', '-f', composeFile];
  switch (action) {
    case 'up':         return [...base, 'up', '-d', '--build'];
    case 'start':      return [...base, 'up', '-d'];
    case 'stop':       return [...base, 'down'];
    case 'down-clean': return [...base, 'down', '-v'];
  }
}

/** Validate user-entered config; returns a list of human-readable problems (empty = ok). */
export function validateConfig(c: InstallerConfig): string[] {
  const errs: string[] = [];
  if (!c.projectName.trim()) errs.push('Project name is required.');
  if (!c.workspacePath.trim()) errs.push('Workspace path is required.');
  if (!c.sourceRepoPath.trim()) errs.push('Product repo path is required.');
  if (!c.postgresPassword.trim()) errs.push('Database password is required.');
  if (!/^\d+$/.test(c.postgresPort)) errs.push('Postgres port must be a number.');
  if (!/^\d+$/.test(c.webPort)) errs.push('Web port must be a number.');
  if (c.authKind === 'oauth_token' && !c.oauthToken.trim()) errs.push('Claude OAuth token is required.');
  if (c.authKind === 'api_key' && !c.apiKey.trim()) errs.push('Anthropic API key is required.');
  if (!c.appSecret.trim()) errs.push('APP_SECRET is missing (internal error).');
  return errs;
}
