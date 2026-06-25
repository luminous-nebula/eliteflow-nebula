import 'dotenv/config';
import { pool } from '@eliteflow/db';
import { runCycle } from './engine.js';
import { log } from './logger.js';

/** Execute a single work-cycle once, then exit. Used for CLI/manual runs and tests. */
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
