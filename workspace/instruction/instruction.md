# AgentFlow Nebula — Master Instructions

These are the operating instructions every persona reads before acting. They define
the single source of truth, how to look data up, and the rules of engagement.

## 1. Single source of truth

There is exactly one source of truth for any given fact. Where it lives depends on
the kind of data:

| Kind of data | Lives in | Example |
|---|---|---|
| Structured / tabular | `database/**/*.csv` | who the personas are, tasks, schedules |
| Narrative / identity / process | markdown files | persona identity, this file, workflows |

Tables and files **cross-reference** each other instead of duplicating:

- A CSV row points to a file or folder through a column whose header ends in `File`, `Folder`, or `Ref`.
- This instruction file points back to the tables you must read (below).

Never copy a fact into two places. If a value is tabular, edit the CSV; if it is prose,
edit the markdown and update the CSV reference if the path changed.

## 2. Tables to look up (read these before working)

Defined in full by `database/schema.json`. The ones you will use most:

- `database/config/config.csv` — project name, base path, source-code path, timezone, and **workflow-name** (determines which operational ruleset you follow).
- `database/persona/team.csv` — the four functional tiers: `tier-0`, `executive`, `revenue`, `production`.
- `database/persona/role.csv` — roles and the team each belongs to.
- `database/persona/persona.csv` — the roster. The `Persona File` column tells you where each persona's identity markdown is.
- `database/project/project.csv`, `phase.csv`, `task.csv` — what work exists, in what phase, with its estimated `Hours` and `Status`.
- `database/config/task-status.csv` — the only allowed task statuses.
- `database/prompt-helper/prompt-helper.csv` — per-persona prompt library (init, scheduled-task, and export/import prompts).
- `database/workflow/scheduled-task.csv` — recurring jobs.

To act as a persona: find your row in `persona.csv`, open the `persona-file` it points
to, then consult `role.csv` and `team.csv` for your remit. To work a project: read
`project.csv` -> `phase.csv` -> `task.csv`, filtered to your `persona-id`.

## 3. Workspace layout

```
database/      structured source of truth (CSV)   -> see schema.json
instruction/   process & identity source of truth (markdown)
persona/       one folder per persona, grouped by functional tier
project/       per-project working folders and deliverables
output/        report/ (subfolders: tier-0/, executive/, revenue/, production/, request/), log/, archive/
docs/          user guide and reference
```

## 4. Rules of engagement

1. **Lookup before action.** Always read the relevant tables (section 2) before making changes.
2. **Referential integrity.** Every `*-id` foreign key must resolve to an existing row. When you add a persona folder, add its `persona.csv` row, and vice versa.
3. **Naming.** Follow `instruction/naming-convention.md` exactly — kebab-case for files/folders/ids; Title Case With Spaces for CSV column headers.
4. **Non-destructive.** Never hard-delete. Move superseded files to `output/archive/` with a `YYYY-MM-DD_` prefix.
5. **Confirm batch changes.** Before moving multiple files or editing many CSV rows, state the intended actions and await approval.
6. **One source of truth.** Do not duplicate a fact across a table and a file.
7. **Write Permissions (task.csv & bug.csv).** Only the Dispatcher (Mensa Nebula) or Orchestrator (Singularity Nebula) may write to `database/project/task.csv`. Production personas must READ this file or `dispatch.csv`, and report progress via execution reports. Mensa handles the centralized state updates. Defect records live in `database/project/bug.csv`, owned and written by **Quasar (QA)** (Mensa/Singularity may co-write the `Fix Task ID` linkage); all other personas report defects via execution reports for Quasar to curate.
8. **Asynchronous / Scheduled Execution.** When running as a scheduled background task, you are in **non-blocking mode**. Do NOT stop the process to use interactive tools (like ask_question), request permissions, or await approval. Log all questions, ambiguities, or pending approvals clearly in your final output report (`output/report/`) and terminate your cycle successfully.
## 5. Standard workflows

Defined in `instruction/workflow.md`: housekeeping, report consolidation, the task
lifecycle, and adding a persona or project.

## 6. Strategic context

For the current strategic decisions that govern the work (business shape, product
sequencing, billing, capacity), read `instruction/strategic-baseline.md`. Superseded and
historical decisions are recorded in `instruction/decision-history.md`.

## 7. Life handoff — continuity across chats

A persona's chat is one *life*. When a chat fills up with tokens, or its identity files or
folder structure change, the next chat is a new life that has lost the prior context. To
carry identity and progress across lives, every persona uses a `next-life-report.md` in its
own folder:

1. **On exit (or when tokens run low):** write
   `persona/<team-id>/<persona-id>/next-life-report.md` capturing your role and identity, the
   task and state you were on, key decisions and rationale, open threads and blockers, and
   the first one to three actions the next life should take. Use your `Export Prompt` from
   `prompt-helper.csv`.
2. **On startup:** after loading this file and your role SKILL, check your own folder for
   `next-life-report.md`. If it exists, read it first to recover context, then create an 'archive' 
   subfolder in your persona folder (if it doesn't exist) and move the report into it, renaming 
   it to `next-life-report.<YYYY-MM-DD-HHMM>.md` so it is not consumed twice.
   Use your `Import Prompt`. If it does not exist, proceed normally.

The report is the bridge between lives — it makes a persona resilient to chat resets and to
changes in its own markdown or folder location.

## 8. Template Sync Policy

When syncing updates from a live working instance back to the canonical template repository, strict segregation between core mechanics and instance data must be maintained:

1. **Core System (SYNC APPROVED):** Changes to rules, workflows, `schema.json`, persona definitions (both markdown and `persona.csv`/`role.csv`), prompt helpers, and structural guidelines must be synced to the template.
2. **Instance Data (DO NOT SYNC):** Live business data—such as tasks (`task.csv`), projects (`project.csv`), local configurations (`config.csv`), cash flow assumptions, and `output/` logs/reports—must never be copied to the template to ensure it remains a pristine, reusable scaffold.
3. **Path Portability:** All paths in the template must use dynamic placeholders (`<base-path>`, `<source-code-path>`) resolved at runtime via `config.csv` rather than hardcoded absolute paths.
