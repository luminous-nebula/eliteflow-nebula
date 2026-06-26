import { getActiveCredential } from '@eliteflow/db';
import { config } from './config.js';
import { log } from './logger.js';

/**
 * Shared helpers for invoking Claude Code headless (`claude -p`). Both the task
 * worker (one-shot, structured report) and the conversational persona runner (the
 * medium) resolve the same credential and parse the same `--output-format json`
 * envelope, so that logic lives here once.
 */

/** Resolve the Claude credential as env vars: stored DB credential first, env fallback. */
export async function credentialEnv(): Promise<Record<string, string>> {
  try {
    const cred = await getActiveCredential();
    if (cred?.kind === 'oauth_token') return { CLAUDE_CODE_OAUTH_TOKEN: cred.value };
    if (cred?.kind === 'api_key') return { ANTHROPIC_API_KEY: cred.value };
  } catch (err) {
    log.warn('credential lookup failed; falling back to env', (err as Error).message);
  }
  const env: Record<string, string> = {};
  if (config.oauthToken) env.CLAUDE_CODE_OAUTH_TOKEN = config.oauthToken;
  if (config.anthropicApiKey) env.ANTHROPIC_API_KEY = config.anthropicApiKey;
  return env;
}

/**
 * Credential-mode guard, run once at startup. CLAUDE_CODE_OAUTH_TOKEN (a Claude
 * subscription) is the intended backend; ANTHROPIC_API_KEY is the metered, per-token
 * alternative. To avoid an accidental metered bill from a stray `.env` value, warn loudly
 * whenever the API key is set — and, when OAUTH_ONLY is enabled, refuse to start so
 * subscription-only operation is guaranteed.
 *
 * Scope: this checks the *env* credential (the likely ".env slip"). A stored DB credential
 * of kind 'api_key' would also bill per token and takes precedence in credentialEnv(); keep
 * that table free of api_key rows when running OAuth-only.
 */
export function assertCredentialMode(): void {
  if (!config.anthropicApiKey) return;
  const oauthOnly = /^(1|true|yes)$/i.test(process.env.OAUTH_ONLY ?? '');
  const detail = config.oauthToken
    ? 'CLAUDE_CODE_OAUTH_TOKEN is also set and wins in env resolution, but a stored api_key credential would override it.'
    : 'No CLAUDE_CODE_OAUTH_TOKEN is set — workers would bill per token.';
  if (oauthOnly) {
    throw new Error(
      `OAUTH_ONLY is enabled but ANTHROPIC_API_KEY is set — refusing to start to avoid metered billing. ` +
        `Clear ANTHROPIC_API_KEY from the environment. ${detail}`,
    );
  }
  log.warn(
    `ANTHROPIC_API_KEY is set — this is the metered, per-token credential, not the Claude subscription. ` +
      `${detail} Clear it, or set OAUTH_ONLY=true to enforce subscription-only.`,
  );
}

export interface ClaudeResult {
  /** The assistant's text result (envelope `.result`, or raw stdout as a fallback). */
  result: string;
  tokensInput: number | null;
  tokensOutput: number | null;
  costUsd: number | null;
}

/** Parse the `claude -p --output-format json` stdout envelope. Falls back to raw
 *  stdout as the result when stdout is not the JSON envelope. */
export function parseClaudeResult(stdout: string): ClaudeResult {
  try {
    const envelope = JSON.parse(stdout) as {
      result?: string;
      total_cost_usd?: number;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    return {
      result: typeof envelope.result === 'string' ? envelope.result : stdout,
      tokensInput: envelope.usage?.input_tokens ?? null,
      tokensOutput: envelope.usage?.output_tokens ?? null,
      costUsd: envelope.total_cost_usd ?? null,
    };
  } catch {
    return { result: stdout, tokensInput: null, tokensOutput: null, costUsd: null };
  }
}
