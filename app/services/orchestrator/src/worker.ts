import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WorkerReport } from '@eliteflow/db';
import { config } from './config.js';
import { log } from './logger.js';
import { credentialEnv } from './claude-headless.js';

const here = dirname(fileURLToPath(import.meta.url));

export interface WorkerInput {
  personaId: string;
  personaName: string;
  role: string;
  initialPersona: string; // the persona's bootstrap prompt (from prompt_helpers)
  taskId: string | null;
  taskName: string;
  taskDescription: string;
  instructions: string; // dispatch instructions
  cycleId: number; // run context (for question attribution)
  taskRunId: number;
}

export interface WorkerResult {
  report: WorkerReport;
  raw: string;
  tokensInput: number | null;
  tokensOutput: number | null;
  costUsd: number | null;
}

const REPORT_CONTRACT = `
When you finish, output your result as the LAST thing in your response, as a fenced JSON
block exactly in this shape (no prose after it):

\`\`\`json
{
  "status": "done | blocked | rejected | failed",
  "summary": "one paragraph on what you did or why you could not",
  "artifacts": ["paths/created/or/changed"],
  "questions": [{ "question": "...", "context": "...", "blocking": false }],
  "next_suggested_persona_id": null
}
\`\`\`
Do not ask interactive questions. If you need something you are not authorized for, put it
in "questions" and continue with what you can.`;

function buildSystemPrompt(input: WorkerInput): string {
  return [
    input.initialPersona.trim(),
    '',
    'OPERATING MODE: You are running non-interactively as part of an automated work-cycle.',
    'Follow the workspace instructions in instruction/instruction.md and your role skill.',
    'Never block on a permission prompt; pre-authorized actions proceed automatically.',
    REPORT_CONTRACT,
  ].join('\n');
}

function buildUserPrompt(input: WorkerInput): string {
  return [
    `You are ${input.personaName} (${input.role}).`,
    input.taskId ? `Task ${input.taskId}: ${input.taskName}` : `Task: ${input.taskName}`,
    '',
    input.taskDescription ? `Description:\n${input.taskDescription}` : '',
    '',
    input.instructions ? `Dispatch instructions:\n${input.instructions}` : '',
    '',
    'Do the work now, then emit the JSON report.',
  ].filter(Boolean).join('\n');
}

/** Write the per-run MCP config that registers the permission-prompt server.
 *  Run context is passed through env so logged questions are attributed correctly. */
function writeMcpConfig(input: WorkerInput): string {
  const dir = mkdtempSync(join(tmpdir(), 'agentflow-mcp-'));
  const file = join(dir, 'mcp.json');
  const permToolPath = join(here, 'permission-tool.ts');
  const cfg = {
    mcpServers: {
      perm: {
        command: 'npx',
        args: ['tsx', permToolPath],
        env: {
          DATABASE_URL: config.databaseUrl,
          AGENTFLOW_CYCLE_ID: String(input.cycleId),
          AGENTFLOW_TASK_RUN_ID: String(input.taskRunId),
          AGENTFLOW_PERSONA_ID: input.personaId,
          AGENTFLOW_TASK_ID: input.taskId ?? '',
        },
      },
    },
  };
  writeFileSync(file, JSON.stringify(cfg, null, 2), 'utf8');
  return file;
}

/** Extract the trailing ```json ... ``` block and parse it into a WorkerReport. */
export function parseReport(resultText: string): WorkerReport {
  const matches = [...resultText.matchAll(/```json\s*([\s\S]*?)```/g)];
  const block = matches.length ? matches[matches.length - 1]![1]! : null;
  if (!block) {
    return { status: 'failed', summary: 'No JSON report block found in worker output.' };
  }
  try {
    const obj = JSON.parse(block) as Partial<WorkerReport>;
    const status = (['done', 'blocked', 'rejected', 'failed'] as const).includes(obj.status as never)
      ? (obj.status as WorkerReport['status'])
      : 'failed';
    return {
      status,
      summary: obj.summary ?? '',
      artifacts: obj.artifacts ?? [],
      questions: obj.questions ?? [],
      next_suggested_persona_id: obj.next_suggested_persona_id ?? null,
    };
  } catch {
    return { status: 'failed', summary: 'Worker JSON report failed to parse.' };
  }
}

function dryRunResult(input: WorkerInput): WorkerResult {
  const report: WorkerReport = {
    status: 'done',
    summary: `[dry-run] ${input.personaName} would execute task ${input.taskId ?? '(none)'}.`,
    artifacts: [],
    questions: [],
    next_suggested_persona_id: null,
  };
  return { report, raw: '[dry-run]', tokensInput: 0, tokensOutput: 0, costUsd: 0 };
}

/**
 * Run one persona as a headless Claude Code process and return its structured report.
 * In dry-run mode, returns a synthetic report so the engine can be exercised offline.
 */
export async function runWorker(input: WorkerInput): Promise<WorkerResult> {
  if (config.dryRun) return dryRunResult(input);

  const mcpConfigPath = writeMcpConfig(input);
  const credEnv = await credentialEnv();
  const args = [
    '-p',
    '--output-format', 'json',
    '--model', config.model,
    '--append-system-prompt', buildSystemPrompt(input),
    '--permission-prompt-tool', 'mcp__perm__permission_prompt',
    '--mcp-config', mcpConfigPath,
    '--add-dir', config.sourceRepoPath,
  ];

  return new Promise<WorkerResult>((resolvePromise) => {
    const child = spawn('claude', args, {
      cwd: config.workspacePath,
      env: { ...process.env, ...credEnv },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.stdin.write(buildUserPrompt(input));
    child.stdin.end();

    child.on('error', (err) => {
      log.error(`worker spawn error for ${input.personaId}`, err.message);
      resolvePromise({
        report: { status: 'failed', summary: `Worker failed to spawn: ${err.message}` },
        raw: err.message, tokensInput: null, tokensOutput: null, costUsd: null,
      });
    });

    child.on('close', (code) => {
      if (code !== 0) {
        log.warn(`worker exited ${code} for ${input.personaId}`, stderr.slice(0, 500));
      }
      let resultText = stdout;
      let tokensInput: number | null = null;
      let tokensOutput: number | null = null;
      let costUsd: number | null = null;
      try {
        const envelope = JSON.parse(stdout) as {
          result?: string;
          total_cost_usd?: number;
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        if (typeof envelope.result === 'string') resultText = envelope.result;
        tokensInput = envelope.usage?.input_tokens ?? null;
        tokensOutput = envelope.usage?.output_tokens ?? null;
        costUsd = envelope.total_cost_usd ?? null;
      } catch {
        // stdout was not the JSON envelope; fall back to raw text parsing.
      }
      const report = parseReport(resultText);
      resolvePromise({ report, raw: stdout, tokensInput, tokensOutput, costUsd });
    });
  });
}
