import 'dotenv/config';
import { pool } from '@eliteflow/db';
import { mediate } from './medium.js';
import { log } from './logger.js';

/**
 * CLI front for the medium. The steward (Regent Systemo) invokes this to relay one
 * founder message to the routed persona and print the signed reply.
 *
 *   npm run medium -- "your message here"          # open a new thread
 *   npm run medium -- --session <id> "follow-up"   # continue a thread
 *
 * Reads the message from the args (or stdin if no message arg is given). The thread id
 * may be given as `--session <id>` or via the MEDIUM_SESSION env var — the env var is
 * the robust path when invoking through the root workspace proxy, which can swallow
 * the `--session` flag across npm's double hop.
 */

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let sessionId: string | undefined = process.env.MEDIUM_SESSION || undefined;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--session' || argv[i] === '-s') { sessionId = argv[++i]; continue; }
    rest.push(argv[i]!);
  }

  const message = rest.join(' ').trim() || (await readStdin());
  if (!message) {
    log.error('No message given. Usage: npm run medium -- "<message>" [--session <id>]');
    process.exit(2);
  }

  const result = await mediate({ message, sessionId });

  // The signed reply is the user-facing payload; the rest is operator context.
  log.info(`session ${result.sessionId} · routed: ${result.reason}`);
  process.stdout.write(`\n${result.reply}\n`);
}

main()
  .then(async () => { await pool.end(); })
  .catch(async (err) => {
    log.error('medium failed', (err as Error).message);
    await pool.end();
    process.exit(1);
  });
