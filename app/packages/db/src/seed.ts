import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { pool } from './index.js';

/**
 * Seed the database from the existing workspace CSVs (the former source of truth).
 * Idempotent: natural-key tables upsert; surrogate-key tables (dispatch, task_plan)
 * are replaced wholesale. Missing or header-only CSVs are skipped with a warning.
 *
 * The workspace database dir is resolved from SEED_DB_PATH, else WORKSPACE_PATH/database.
 */

const dbDir = process.env.SEED_DB_PATH
  ? resolve(process.env.SEED_DB_PATH)
  : resolve(process.env.WORKSPACE_PATH ?? '../workspace', 'database');

type Coerce = 'text' | 'int' | 'num' | 'bool' | 'date';

interface ColMap {
  col: string;
  header: string;
  type?: Coerce;
}

interface TableSpec {
  file: string; // relative to dbDir
  table: string;
  pk: string[]; // empty => surrogate key, replace wholesale
  columns: ColMap[];
}

function coerce(raw: unknown, type: Coerce = 'text'): unknown {
  const s = raw == null ? '' : String(raw).trim();
  switch (type) {
    case 'bool':
      if (/^true$/i.test(s)) return true;
      if (/^false$/i.test(s)) return false;
      return s === '' ? false : Boolean(s);
    case 'int': {
      if (s === '') return null;
      const n = parseInt(s, 10);
      return Number.isNaN(n) ? null : n;
    }
    case 'num': {
      if (s === '') return null;
      const n = Number(s);
      return Number.isNaN(n) ? null : n;
    }
    case 'date':
      return s === '' ? null : s;
    default:
      return s === '' ? null : s;
  }
}

// Dependency-ordered: lookups → org → library → projects → work.
const SPECS: TableSpec[] = [
  { file: 'config/task-status.csv', table: 'task_status', pk: ['status'], columns: [
    { col: 'status', header: 'Status' }, { col: 'sort_order', header: 'Sort Order', type: 'int' }, { col: 'description', header: 'Description' } ] },
  { file: 'config/persona-status.csv', table: 'persona_status', pk: ['status'], columns: [
    { col: 'status', header: 'Status' }, { col: 'description', header: 'Description' } ] },
  { file: 'config/bug-status.csv', table: 'bug_status', pk: ['status'], columns: [
    { col: 'status', header: 'Status' }, { col: 'sort_order', header: 'Sort Order', type: 'int' }, { col: 'description', header: 'Description' } ] },
  { file: 'config/bug-severity.csv', table: 'bug_severity', pk: ['severity'], columns: [
    { col: 'severity', header: 'Severity' }, { col: 'sort_order', header: 'Sort Order', type: 'int' }, { col: 'description', header: 'Description' }, { col: 'target_response', header: 'Target Response' } ] },
  { file: 'config/month.csv', table: 'months', pk: ['month_no'], columns: [
    { col: 'month_no', header: 'Month No', type: 'int' }, { col: 'month', header: 'Month' }, { col: 'short', header: 'Short' } ] },
  { file: 'config/day-of-week.csv', table: 'days_of_week', pk: ['day_no'], columns: [
    { col: 'day_no', header: 'Day No', type: 'int' }, { col: 'day_of_week', header: 'Day Of Week' }, { col: 'short', header: 'Short' } ] },
  { file: 'config/config.csv', table: 'config', pk: ['property'], columns: [
    { col: 'property', header: 'Property' }, { col: 'value', header: 'Value' } ] },

  { file: 'persona/team.csv', table: 'teams', pk: ['team_id'], columns: [
    { col: 'team_id', header: 'Team ID' }, { col: 'team', header: 'Team' }, { col: 'tier_order', header: 'Tier Order', type: 'int' }, { col: 'description', header: 'Description' } ] },
  { file: 'persona/role.csv', table: 'roles', pk: ['role_id'], columns: [
    { col: 'role_id', header: 'Role ID' }, { col: 'role', header: 'Role' }, { col: 'team_id', header: 'Team ID' }, { col: 'description', header: 'Description' } ] },
  { file: 'persona/persona.csv', table: 'personas', pk: ['persona_id'], columns: [
    { col: 'persona_id', header: 'Persona ID' }, { col: 'persona_name', header: 'Persona Name' }, { col: 'role_id', header: 'Role ID' }, { col: 'team_id', header: 'Team ID' }, { col: 'status', header: 'Status' }, { col: 'origin', header: 'Origin' }, { col: 'persona_file', header: 'Persona File' } ] },

  { file: 'prompt-helper/prompt-helper.csv', table: 'prompt_helpers', pk: ['persona_id'], columns: [
    { col: 'persona_id', header: 'Persona ID' }, { col: 'initial_persona', header: 'Initial Persona' }, { col: 'scheduled_task', header: 'Scheduled Task' }, { col: 'export_prompt', header: 'Export Prompt' }, { col: 'import_prompt', header: 'Import Prompt' } ] },
  { file: 'workflow/scheduled-task.csv', table: 'scheduled_tasks', pk: ['schedule_id'], columns: [
    { col: 'schedule_id', header: 'Schedule ID' }, { col: 'persona_id', header: 'Persona ID' }, { col: 'cron', header: 'Cron' }, { col: 'action', header: 'Action' }, { col: 'purpose', header: 'Purpose/Description' }, { col: 'status', header: 'Status' }, { col: 'prompt', header: 'Prompt' }, { col: 'kind', header: 'Kind' } ] },

  { file: 'project/project.csv', table: 'projects', pk: ['project_id'], columns: [
    { col: 'priority', header: 'Priority', type: 'int' }, { col: 'project_id', header: 'Project ID' }, { col: 'project_name', header: 'Project Name' }, { col: 'status', header: 'Status' }, { col: 'target_market', header: 'Target Market' }, { col: 'pain_intensity', header: 'Pain Intensity' }, { col: 'revenue_potential', header: 'Revenue Potential' }, { col: 'strategic_fit', header: 'Strategic Fit (Synergy)' }, { col: 'moat', header: 'Moat (Defensibility)' }, { col: 'autonomy', header: 'Autonomy (Zero Ops)' }, { col: 'ease_of_execution', header: 'Ease of Execution' }, { col: 'speed_to_mvp', header: 'Speed to MVP' }, { col: 'weeks_to_mvp', header: 'Weeks to MVP' }, { col: 'total_score', header: 'Total Score (%)' }, { col: 'description', header: 'Description' }, { col: 'project_folder', header: 'Project Folder' } ] },
  { file: 'project/phase.csv', table: 'phases', pk: ['phase_id'], columns: [
    { col: 'phase_id', header: 'Phase ID' }, { col: 'project_id', header: 'Project ID' }, { col: 'phase_no', header: 'Phase No', type: 'int' }, { col: 'phase_name', header: 'Phase Name' }, { col: 'status', header: 'Status' }, { col: 'description', header: 'Description' } ] },
  { file: 'project/task.csv', table: 'tasks', pk: ['task_id'], columns: [
    { col: 'task_id', header: 'Task ID' }, { col: 'project_id', header: 'Project ID' }, { col: 'phase_id', header: 'Phase ID' }, { col: 'task_name', header: 'Task Name' }, { col: 'description', header: 'Description' }, { col: 'hours', header: 'Hours', type: 'num' }, { col: 'cycles', header: 'Cycles', type: 'int' }, { col: 'status', header: 'Status' }, { col: 'auto', header: 'Auto', type: 'bool' }, { col: 'task_type', header: 'Task Type' }, { col: 'date_started', header: 'Date Started', type: 'date' }, { col: 'date_completed', header: 'Date Completed', type: 'date' } ] },
  { file: 'project/dispatch.csv', table: 'dispatch', pk: [], columns: [
    { col: 'date', header: 'Date', type: 'date' }, { col: 'cycle_no', header: 'Cycle No', type: 'int' }, { col: 'task_id', header: 'Task ID' }, { col: 'assignee_persona_id', header: 'Assignee Persona ID' }, { col: 'instructions', header: 'Instructions' }, { col: 'status', header: 'Status' } ] },
  { file: 'project/bug.csv', table: 'bugs', pk: ['bug_id'], columns: [
    { col: 'bug_id', header: 'Bug ID' }, { col: 'project_id', header: 'Project ID' }, { col: 'phase_id', header: 'Phase ID' }, { col: 'title', header: 'Title' }, { col: 'severity', header: 'Severity' }, { col: 'status', header: 'Status' }, { col: 'reporter_persona_id', header: 'Reporter Persona ID' }, { col: 'assignee_persona_id', header: 'Assignee Persona ID' }, { col: 'fix_task_id', header: 'Fix Task ID' }, { col: 'date_reported', header: 'Date Reported', type: 'date' }, { col: 'date_resolved', header: 'Date Resolved', type: 'date' }, { col: 'bug_ref', header: 'Bug Ref' } ] },
  { file: 'project/task-plan.csv', table: 'task_plan', pk: [], columns: [
    { col: 'task_id', header: 'Task ID' }, { col: 'date', header: 'Date', type: 'date' }, { col: 'hours', header: 'Hours', type: 'num' } ] },
];

interface CsvRow { [key: string]: string }

async function seedTable(spec: TableSpec): Promise<void> {
  const path = join(dbDir, spec.file);
  if (!existsSync(path)) {
    console.log(`· skip   ${spec.file} (not found)`);
    return;
  }
  const content = await readFile(path, 'utf8');
  const rows = parse(content, { columns: true, bom: true, skip_empty_lines: true, trim: false }) as CsvRow[];
  if (rows.length === 0) {
    console.log(`· skip   ${spec.file} (no data rows)`);
    return;
  }

  const cols = spec.columns.map((c) => c.col);

  if (spec.pk.length === 0) {
    await pool.query(`TRUNCATE ${spec.table} RESTART IDENTITY CASCADE`);
  }

  let n = 0;
  let skipped = 0;
  let firstSkip = '';
  for (const row of rows) {
    const values = spec.columns.map((c) => coerce(row[c.header], c.type));
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    let sql = `INSERT INTO ${spec.table} (${cols.join(', ')}) VALUES (${placeholders})`;
    if (spec.pk.length > 0) {
      const updates = cols.filter((c) => !spec.pk.includes(c)).map((c) => `${c} = EXCLUDED.${c}`);
      sql += ` ON CONFLICT (${spec.pk.join(', ')}) DO UPDATE SET ${updates.join(', ')}`;
    }
    try {
      await pool.query(sql, values);
      n++;
    } catch (err) {
      // Tolerate dirty legacy data: skip rows that violate an integrity constraint
      // (FK/unique/not-null/check — SQLSTATE class 23) but fail loudly on structural
      // errors (bad column/table, type mismatch, connection, …).
      const code = (err as { code?: string }).code ?? '';
      if (!code.startsWith('23')) throw err;
      skipped++;
      if (!firstSkip) firstSkip = (err as { detail?: string }).detail ?? (err as Error).message;
    }
  }
  const note = skipped ? `  (skipped ${skipped}: ${firstSkip})` : '';
  console.log(`✓ seed   ${spec.table.padEnd(16)} ${n} row(s)${note}`);
}

async function main(): Promise<void> {
  console.log(`Seeding from: ${dbDir}\n`);
  // Harden the seed: a single table's structural failure (missing/renamed column,
  // type mismatch, bad CSV) must not abort the rest — collect it and keep going so
  // every healthy table still seeds. (Per-row integrity violations are already
  // tolerated inside seedTable; this guards table-level failures.) We still surface a
  // non-zero exit at the end so the failure is never silent.
  const failed: Array<{ table: string; message: string }> = [];
  for (const spec of SPECS) {
    try {
      await seedTable(spec);
    } catch (err) {
      failed.push({ table: spec.table, message: (err as Error).message });
      console.error(`✗ fail   ${spec.table.padEnd(16)} ${(err as Error).message}`);
    }
  }
  await pool.end();
  if (failed.length > 0) {
    console.error(`\nSeed finished with ${failed.length} failed table(s): ${failed.map((f) => f.table).join(', ')}`);
    process.exitCode = 1;
    return;
  }
  console.log('\nSeed complete.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
