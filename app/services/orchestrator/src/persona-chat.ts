import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPersonaPrompt } from '@eliteflow/db';
import { config } from './config.js';
import { log } from './logger.js';
import { credentialEnv, parseClaudeResult } from './claude-headless.js';

/**
 * The conversational persona runner — generalized from the web planning console's
 * single-persona chat into a runner for ANY persona (ADR-0002 D2 / workstream C).
 *
 * It runs one turn of a founder ↔ persona conversation as a headless `claude -p`
 * invocation, speaking as the persona (its bootstrap prompt becomes the system
 * prompt) within an optional per-persona tool scope. Turns are stateless: the prior
 * messages are replayed as context, so no fragile `--session-id`/`--resume` is used.
 */

export interface ChatMessageLite {
  role: 'user' | 'assistant';
  content: string;
}

export interface PersonaChatInput {
  personaId: string;
  /** Full conversation so far; the last entry is the new founder message. */
  messages: ChatMessageLite[];
  /** Override the operating-mode block appended to the persona's bootstrap prompt.
   *  Defaults to the medium (founder-facing) framing. Used by Mensa planning. */
  operatingMode?: string;
  /** Explicit allowed-tools list; defaults to the per-persona TOOL_SCOPE. */
  tools?: string[];
}

export interface PersonaChatResult {
  reply: string;
  tokensInput: number | null;
  tokensOutput: number | null;
  costUsd: number | null;
}

/**
 * Per-persona tool scope. The medium is a conversational front door, so personas
 * answer with no file/shell tools by default — they advise and relay. Personas that
 * need tools to do their job conversationally are listed here. (Future: derive this
 * from the `permissions` table per persona.)
 */
const TOOL_SCOPE: Record<string, string[]> = {};

function toolsFor(personaId: string): string[] {
  return TOOL_SCOPE[personaId] ?? [];
}

// A stable cwd for the headless conversation engine (each turn is self-contained).
const chatCwd = join(tmpdir(), 'eliteflow-medium');
if (!existsSync(chatCwd)) mkdirSync(chatCwd, { recursive: true });

function mediumMode(name: string): string {
  return [
    `OPERATING MODE — Medium. You are ${name}, speaking directly with the founder through`,
    'the system steward (Regent Systemo), who routed this message to you. Answer as yourself,',
    'in your own voice and area of responsibility. Be concise and direct.',
    '- Do not greet or sign off; the steward attributes your reply to you automatically.',
    '- If the request is outside your remit, say so briefly and suggest who should handle it.',
    '- You are in a conversation, not an automated work-cycle: advise and decide; do not',
    '  emit a JSON report.',
  ].join('\n');
}

function systemPrompt(name: string, initial: string, operatingMode?: string): string {
  return [initial.trim(), '', operatingMode ?? mediumMode(name)].join('\n');
}

/** Replay the conversation as context so each turn is stateless. */
function buildPrompt(name: string, messages: ChatMessageLite[]): string {
  if (messages.length <= 1) return messages[0]?.content ?? '';
  const convo = messages
    .map((m) => `${m.role === 'user' ? 'Founder' : name}: ${m.content}`)
    .join('\n\n');
  return [
    'Conversation so far:', '', convo, '', '---',
    `Reply as ${name} to the Founder's most recent message above. Keep it concise.`,
  ].join('\n');
}

function dryRunReply(name: string, messages: ChatMessageLite[]): PersonaChatResult {
  const last = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  return {
    reply: `[dry-run] ${name} would reply to: "${last.slice(0, 120)}"`,
    tokensInput: 0, tokensOutput: 0, costUsd: 0,
  };
}

/** Run one conversational turn for `personaId`. In dry-run, returns a synthetic reply. */
export async function runPersonaChat(input: PersonaChatInput): Promise<PersonaChatResult> {
  const persona = await getPersonaPrompt(input.personaId);
  const name = persona?.name ?? input.personaId;

  if (config.dryRun) return dryRunReply(name, input.messages);

  const sys = systemPrompt(name, persona?.initial ?? '', input.operatingMode);
  const prompt = buildPrompt(name, input.messages);
  const credEnv = await credentialEnv();

  const args = [
    '-p',
    '--output-format', 'json',
    '--model', config.model,
    '--append-system-prompt', sys,
  ];
  const tools = input.tools ?? toolsFor(input.personaId);
  if (tools.length > 0) args.push('--allowedTools', tools.join(','));

  return new Promise<PersonaChatResult>((resolvePromise) => {
    const child = spawn('claude', args, { cwd: chatCwd, env: { ...process.env, ...credEnv } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.stdin.write(prompt);
    child.stdin.end();

    child.on('error', (err) => {
      log.error(`medium chat spawn error for ${input.personaId}`, err.message);
      resolvePromise({
        reply: `(${name} could not be reached: ${err.message})`,
        tokensInput: null, tokensOutput: null, costUsd: null,
      });
    });

    child.on('close', (code) => {
      if (code !== 0) log.warn(`medium chat exited ${code} for ${input.personaId}`, stderr.slice(0, 300));
      const parsed = parseClaudeResult(stdout);
      let reply = parsed.result.trim();
      if (code !== 0 && !reply) reply = `(${name}'s chat engine exited ${code}.)`;
      resolvePromise({
        reply: reply || '(no response)',
        tokensInput: parsed.tokensInput,
        tokensOutput: parsed.tokensOutput,
        costUsd: parsed.costUsd,
      });
    });
  });
}
