import 'dotenv/config';
import { pool } from '@eliteflow/db';
import { runCycle } from './engine.js';
import { assertCredentialMode } from './claude-headless.js';
import { log } from './logger.js';

/** Execute a single work-cycle once, then exit. Used for CLI/manual runs and tests. */
try {
  assertCredentialMode(); // warn on metered ANTHROPIC_API_KEY; refuse if OAUTH_ONLY
} catch (err) {
  log.error((err as Error).message);
  process.exit(1);
}

runCycle('manual')
  .then(async (r) => {
    log.info(`Cycle ${r.cycleId} finished with ${r.runs} run(s).`);
    await pool.end();
  })
  .catch(async (err) => {
    log.error('Cycle failed', (err as Error).message);
    await pool.end();
    process.exit(1);
  });
