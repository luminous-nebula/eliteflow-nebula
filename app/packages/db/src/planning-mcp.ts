import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { query } from './index.js';

/**
 * MCP stdio server "planning" — the tools a strategy persona (Carina) uses during a
 * planning chat to turn business ideas into structured rows: projects (= products) and
 * phases. Launched by Claude Code via --mcp-config; talks to Postgres directly.
 */

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'project';
}

async function uniqueId(table: 'projects' | 'phases', col: string, base: string): Promise<string> {
  let id = base;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while ((await query(`SELECT 1 FROM ${table} WHERE ${col} = $1`, [id])).rows.length) {
    id = `${base}-${++n}`;
  }
  return id;
}

function text(obj: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(obj) }] };
}

const server = new McpServer({ name: 'planning', version: '0.1.0' });

server.tool(
  'list_projects',
  'List existing projects (products) so you can build on them and avoid duplicates.',
  {},
  async () => {
    const { rows } = await query(
      `SELECT project_id, project_name, status, description FROM projects ORDER BY project_id`);
    return text({ projects: rows });
  },
);

server.tool(
  'list_phases',
  'List phases, optionally filtered to one project.',
  { project_id: z.string().optional() },
  async ({ project_id }) => {
    const { rows } = project_id
      ? await query(`SELECT phase_id, project_id, phase_no, phase_name, status FROM phases WHERE project_id = $1 ORDER BY phase_no`, [project_id])
      : await query(`SELECT phase_id, project_id, phase_no, phase_name, status FROM phases ORDER BY project_id, phase_no`);
    return text({ phases: rows });
  },
);

server.tool(
  'create_project',
  'Create a project (a product). Provide a clear name; id is generated if omitted.',
  {
    project_name: z.string(),
    description: z.string().optional(),
    status: z.string().optional(),
    project_id: z.string().optional(),
  },
  async ({ project_name, description, status, project_id }) => {
    const id = project_id ?? (await uniqueId('projects', 'project_id', slug(project_name)));
    try {
      await query(
        `INSERT INTO projects (project_id, project_name, status, description) VALUES ($1, $2, $3, $4)`,
        [id, project_name, status ?? 'planned', description ?? null]);
    } catch (err) {
      return text({ error: (err as Error).message });
    }
    return text({ created: 'project', project_id: id, project_name });
  },
);

server.tool(
  'create_phase',
  'Add a phase to an existing project. phase_no auto-increments per project if omitted.',
  {
    project_id: z.string(),
    phase_name: z.string(),
    description: z.string().optional(),
    status: z.string().optional(),
    phase_no: z.number().int().optional(),
    phase_id: z.string().optional(),
  },
  async ({ project_id, phase_name, description, status, phase_no, phase_id }) => {
    const proj = await query(`SELECT 1 FROM projects WHERE project_id = $1`, [project_id]);
    if (proj.rows.length === 0) {
      return text({ error: `project_id "${project_id}" does not exist — create the project first or call list_projects.` });
    }
    const no = phase_no ?? (await query<{ n: number }>(
      `SELECT COALESCE(MAX(phase_no), 0) + 1 AS n FROM phases WHERE project_id = $1`, [project_id])).rows[0]!.n;
    const id = phase_id ?? (await uniqueId('phases', 'phase_id', `${project_id}-ph${String(no).padStart(2, '0')}`));
    try {
      await query(
        `INSERT INTO phases (phase_id, project_id, phase_no, phase_name, status, description) VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, project_id, no, phase_name, status ?? 'planned', description ?? null]);
    } catch (err) {
      return text({ error: (err as Error).message });
    }
    return text({ created: 'phase', phase_id: id, project_id, phase_no: no, phase_name });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
