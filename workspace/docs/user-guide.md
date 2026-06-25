# AgentFlow Nebula — User Guide

Version 2.0.0

AgentFlow Nebula is a template for running a team of AI personas over a shared,
file-based workspace. This guide explains the design, the conventions, and the day-to-day
workflows.

---

## 1. Concept

You manage a roster of **personas** (named after nebulae and space objects) organized
into four **functional tiers**. Their identity and process live in markdown; everything
structured lives in CSV tables. One persona — **Singularity Nebula** (Tier 0) — keeps the
workspace organized.

Two parallel artifacts use the same structure:

- **Template** (`source-code/luminous/agentflow-nebula`): the reusable, generic skeleton.
- **Project** (`.../Project/00 agentflow-nebula`): the template instantiated with real data.

The rule: **the project keeps the template's structure exactly**; only the data differs.

---

## 2. Single source of truth

Every fact lives in exactly one place, chosen by its type:

| Data type | Home | Edit here |
|---|---|---|
| Structured / tabular | `database/**/*.csv` | personas, roles, teams, projects, phases, tasks, schedules, config |
| Narrative / identity / process | markdown files | persona identities, instructions, workflows, naming rules |

They **reference** each other instead of duplicating:

- CSV rows point to files via columns ending in `File` / `Folder` / `Ref`
  (e.g. `persona.csv` -> `persona-file` -> the persona's `.md`).
- `instruction/instruction.md` names the tables each persona must read.

If you change a path, update the reference. Never paste the same fact into two places.

---

## 3. Directory layout

```
agentflow-nebula/
├── README.md                  quick start
├── setup.sh / setup.bat       bootstrap a project
├── docs/
│   └── user-guide.md          this document
├── database/                  STRUCTURED source of truth (CSV)
│   ├── schema.json            describes every table + relationships
│   ├── config/                config.csv + enums + calendar lookups
│   ├── persona/               team.csv, role.csv, persona.csv
│   ├── project/               project.csv, phase.csv, task.csv
│   ├── prompt-helper/         reusable prompts
│   └── workflow/              scheduled-task.csv
├── instruction/               NARRATIVE source of truth (markdown)
│   ├── instruction.md         master operating manual
│   ├── workflow.md            standard workflows
│   ├── naming-convention.md   the naming rules
│   └── role/                  role "skills": installer, manager, executive-consultant
├── persona/                   one folder per persona, by functional tier
│   ├── tier-0/                singularity-nebula
│   ├── executive/             giga-nebula, carina-nebula, vela-nebula
│   ├── revenue/               marketing, brand, sales personas
│   └── production/            engineering, operations personas
├── project/                   per-project working folders + deliverables
└── output/
    ├── report/                consolidated master reports
    ├── log/                    run logs
    └── archive/                superseded files, YYYY-MM-DD_ prefixed
```

---

## 4. The tables

Full definitions are in `database/schema.json`. Summary:

| Table | Holds | Key |
|---|---|---|
| `config/config.csv` | project name, base path, source-code path, timezone | property |
| `config/persona-status.csv` | allowed persona statuses | status |
| `config/task-status.csv` | allowed task statuses + order | status |
| `config/day-of-week.csv`, `month.csv` | calendar lookups | no |
| `persona/team.csv` | the four functional tiers | team-id |
| `persona/role.csv` | roles, each in one team | role-id |
| `persona/persona.csv` | the roster; links to each persona's md | persona-id |
| `project/project.csv` | projects | project-id |
| `project/phase.csv` | phases per project | phase-id |
| `project/task.csv` | actual assigned tasks | task-id |
| `prompt-helper/prompt-helper.csv` | reusable trigger prompts | helper-id |
| `workflow/scheduled-task.csv` | recurring jobs | schedule-id |

Foreign keys (e.g. `task.assignee-persona-id` -> `persona.persona-id`) must always
resolve. Adding a persona folder means adding its `persona.csv` row, and vice versa.

---

## 5. Personas and tiers

Teams are **functional tiers** (not Red/Blue squads):

| Tier (`team-id`) | Remit | Example personas |
|---|---|---|
| `tier-0` | Orchestration, architecture, housekeeping | singularity-nebula |
| `executive` | Executive business consulting, strategy, financial planning | giga-nebula, carina-nebula, vela-nebula |
| `revenue` | Marketing, brand, market research, sales, CS | mensa-, pictor-, quasar-nebula |
| `production` | Engineering, software dev, QA, operations | doradus-, daedalus-nebula |

A persona folder is `persona/<team-id>/<persona-id>/<persona-id>.md`. The `.md` is the
persona's identity/prompt; its row in `persona.csv` is the structured record.

---

## 6. Naming convention

**kebab-case, lowercase, no spaces** — everywhere. Full rules in
`instruction/naming-convention.md`. Highlights:

- Folders, files, and ids: `kebab-case`. CSV column headers: `Title Case With Spaces`.
- Personas: `<name>-nebula`. Projects: a kebab slug like `luminous-forge`.
- Dated deliverables: `YYYY-MM-DD_<kebab-name>[-v<n>].<ext>`
  e.g. `2026-06-01_cash-flow-model-v6.xlsx`.
- Archived files keep/gain the `YYYY-MM-DD_` prefix and move to `output/archive/`.

---

## 7. Common workflows

Defined in `instruction/workflow.md`.

**Bootstrap a project.** Run `setup.sh` / `setup.bat`. It writes `config.csv` and creates
`output/`. (Installer role skill.)

**Add a persona.** Pick a `team-id` and `role-id`; create
`persona/<team-id>/<persona-id>/<persona-id>.md`; append the `persona.csv` row.

**Add a project.** Append to `project.csv`; create `project/<project-id>/project.md`;
add `phase.csv` rows, then `task.csv` rows. (Manager role skill.)

**Task lifecycle.** Status moves through the values in `task-status.csv`:
`backlog -> planned -> in-progress -> blocked? -> review -> done -> archived`. Set
`output-ref` when a deliverable lands.

**Run Housekeeping** (say "Run Housekeeping"). Singularity scans for misplaced/misnamed
files and proposes a move/archive list for approval.

**Consolidate Reports** (say "Consolidate Reports"). Singularity synthesizes a master
summary from `output/report/` and task outputs.

---

## 8. Working as a persona (checklist)

1. Read `instruction/instruction.md`.
2. Find your row in `persona/persona.csv`; open your `persona-file`.
3. Check your remit in `role.csv` / `team.csv`.
4. Read open work in `project/task.csv` filtered to your `persona-id`.
5. Do the work; save deliverables under `project/<project-id>/`; set `output-ref`.
6. Follow the naming convention; archive — never delete.

---

## 9. Extending the system

- **New tier or role:** add to `team.csv` / `role.csv` first, then personas.
- **New table:** add the CSV, then document it in `schema.json`.
- **New recurring job:** add a row to `workflow/scheduled-task.csv`.

Keep structure identical between template and project; let the data carry the difference.
