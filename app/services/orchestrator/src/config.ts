import { resolve } from 'node:path';

/** Centralized, typed view of the orchestrator's environment configuration. */
export const config = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  // Secret used to decrypt the stored Claude credential (must match the web app).
  appSecret: process.env.APP_SECRET ?? '',
  // Env fallback used only to bootstrap before a credential is saved via the web UI.
  // Provide exactly one. OAuth token uses a Claude subscription; API key bills per token.
  oauthToken: process.env.CLAUDE_CODE_OAUTH_TOKEN ?? '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  model: process.env.CLAUDE_MODEL ?? 'claude-opus-4-8',

  /** Mounted workspace (instruction/, persona/, database/ source CSVs). */
  workspacePath: resolve(process.env.WORKSPACE_PATH ?? '../workspace'),
  /** The product repo the personas generate/edit (sibling `product/` folder). */
  sourceRepoPath: resolve(process.env.SOURCE_REPO_PATH ?? '../product'),

  cycleCron: process.env.CYCLE_CRON ?? '*/30 * * * *',
  maxRunsPerCycle: Number(process.env.MAX_RUNS_PER_CYCLE ?? 12),

  /** Opt-in: let LLM-Mensa order a scheduled work_cycle's plan via the persona runner.
   *  Off by default — the deterministic dispatch read is the planner and the fallback. */
  mensaPlanning: /^(1|true|yes)$/i.test(process.env.MENSA_PLANNING ?? ''),

  /** When true, workers return a synthetic report instead of invoking Claude Code.
   *  Lets the engine + DB be exercised without the API/CLI. */
  dryRun: /^(1|true|yes)$/i.test(process.env.ORCHESTRATOR_DRY_RUN ?? ''),
} as const;

export type Config = typeof config;
