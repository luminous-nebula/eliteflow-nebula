import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, withTransaction } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(here, '..', 'schema');

/**
 * Apply every schema/*.sql file (in filename order) that has not been applied yet.
 * Each file runs in its own transaction; applied filenames are recorded in
 * schema_migrations so re-running is a no-op.
 */
async function main(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(schemaDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    (await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations'))
      .rows.map((r) => r.filename),
  );

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`· skip   ${file} (already applied)`);
      continue;
    }
    const sql = await readFile(join(schemaDir, file), 'utf8');
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    });
    console.log(`✓ apply  ${file}`);
    count++;
  }

  console.log(count === 0 ? 'Up to date — no migrations applied.' : `Applied ${count} migration(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
