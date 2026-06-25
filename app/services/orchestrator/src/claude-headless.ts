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
