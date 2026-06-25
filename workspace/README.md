# AgentFlow Nebula

> A general-purpose template for running a team of AI personas over a shared,
> file-based workspace.

AgentFlow Nebula gives a set of AI personas one organized place to work. Structured
data lives in CSV tables (the "database"); identity and process live in markdown.
A Tier-0 persona, **Singularity Nebula**, keeps the workspace clean.

This README is the orientation and quick start. For the full manual — every table,
workflow, and persona checklist — see **[`docs/user-guide.md`](docs/user-guide.md)**.

## Quick start

```bash
./setup.sh        # POSIX
setup.bat         # Windows
```

Setup asks for the project name and source-code path, writes
`database/config/config.csv`, and creates `output/{report,log,archive}`.

## Installing & running the team

AgentFlow Nebula is platform-agnostic — the workspace is just files in a folder. You
run the personas by pointing an agentic tool at this folder and bootstrapping each one
with its prompt from `database/prompt-helper/prompt-helper.csv`. Two setups are
supported today: **Claude Cowork** and **Google Antigravity 2.0**.

### Claude Cowork Project

1. Install the Claude desktop app from <https://claude.com/download> and open the
   **Cowork** tab.
2. In the left navigation, choose **Projects → + → Use an existing folder**, and select
   this workspace folder (the repo root). Name the project and create it. Cowork can now
   read and write the files in this folder directly — you connect the folder once and
   everything inside it is available to every task.
3. *(Optional)* In the project's **Instructions**, tell Claude to read
   `instruction/instruction.md` first as its operating manual.
4. **Bootstrap a persona.** Start a new task in the project and paste that persona's
   `Initial Persona` prompt from `database/prompt-helper/prompt-helper.csv`. The prompt
   loads the persona's identity, requests access to the folders it needs, and reads the
   instructions.
5. **Recurring jobs.** Run the persona's `Scheduled Task` prompt to create its Claude
   Scheduled Tasks from `database/workflow/scheduled-task.csv`. Cowork scheduled tasks
   only fire while the Claude desktop app is open; a missed run executes on next launch.

### Google Antigravity 2.0

1. Download and install **Antigravity** (macOS, Windows, or supported Linux) from the
   official site, <https://antigravity.google>. It has two surfaces: the **Editor View**
   (an AI-powered IDE) and the **Manager View** (orchestrates multiple agents). Toggle
   between them with **Ctrl+E** (Windows/Linux) or **Cmd+E** (macOS).
2. Open this workspace folder as a **Project** (Editor View → open folder). The project
   defines the boundary of folders an agent is allowed to access.
3. *(Recommended)* Add an **`AGENTS.md`** file at the repo root with standing
   instructions for every agent — e.g. "Read `instruction/instruction.md` before acting,
   and follow `instruction/naming-convention.md`." Antigravity reads `AGENTS.md` the way
   Claude Code reads `CLAUDE.md`.
4. **Bootstrap a persona.** Switch to **Manager View** and click **Start Conversation**
   to spawn an agent. Select this workspace, pick a model, then paste the persona's
   `Initial Persona` prompt from `database/prompt-helper/prompt-helper.csv`. You can run
   several personas in parallel, each in its own agent.
5. Pick a development mode — **agent-assisted** is the recommended balance of autonomy
   and control.

## Repository layout

| Path | Purpose |
|---|---|
| `database/` | Structured source of truth (CSV). Described by `database/schema.json`. |
| `instruction/` | Process & identity source of truth (markdown). Start at `instruction/instruction.md`. |
| `persona/` | One folder per persona, grouped by functional tier. |
| `project/` | Per-project working folders and deliverables. |
| `output/` | `report/` (consolidated), `log/`, `archive/` (dated, superseded files). |
| `docs/` | The user guide. |

## Core concepts

- **Single source of truth.** Tabular data lives in CSV; narrative lives in markdown.
  They cross-reference (via columns ending in `File` / `Folder` / `Ref`), never duplicate.
- **Functional tiers.** Every persona belongs to one tier: `tier-0`, `executive`,
  `revenue`, or `production`.
- **One naming rule.** kebab-case, lowercase, no spaces — for files, folders, and
  ids; CSV column headers use Title Case With Spaces. Dated files use
  `YYYY-MM-DD_<name>[-v<n>].<ext>`.
  See `instruction/naming-convention.md`.
- **Non-destructive.** Nothing is deleted; superseded files move to `output/archive/`.

## Adding a persona

The roster lives in `database/persona/persona.csv`; each persona's identity lives in a
markdown file. To add one (this mirrors **Workflow D** in `instruction/workflow.md`):

1. **Pick a team and role.** Choose a `Team ID` (`tier-0`, `executive`, `revenue`, or
   `production`) from `database/persona/team.csv` and a `Role ID` from
   `database/persona/role.csv`. If no role fits, add one first — each role has a skill at
   `instruction/role/<role-id>/SKILL.md`.
2. **Create the identity file.** Make the folder `persona/<team-id>/<persona-id>/` and
   the file `<persona-id>.md` inside it (copy an existing persona as the structural
   reference). Use a `<name>-nebula` id, kebab-case.
3. **Register the persona.** Append a row to `database/persona/persona.csv`:
   `Persona ID, Persona Name, Role ID, Team ID, Status, Origin, Persona File`. Set
   `Origin` to where you created it — `Claude Cowork Project` or `Antigravity Project`.
4. **Add its prompts.** Append a row to `database/prompt-helper/prompt-helper.csv` with
   the persona's `Initial Persona`, `Scheduled Task`, `Export Prompt`, and `Import Prompt`
   (copy an existing row and adapt the identity line and the folder-access paths).
5. *(Optional)* Add any recurring jobs for the persona to
   `database/workflow/scheduled-task.csv`.
6. **Bootstrap it on your platform.** In **Cowork**, paste the persona's `Initial
   Persona` prompt into the project; in **Antigravity**, spawn an agent in Manager View
   with that prompt.

Keep referential integrity: every `Role ID` and `Team ID` must resolve to an existing
row, and the persona folder and its `persona.csv` row are always added together.

## Where to go next

| You want to… | Read |
|---|---|
| Understand the whole system | `docs/user-guide.md` |
| Operate as / with personas | `instruction/instruction.md` |
| Know the data model | `database/schema.json` |
| Follow a workflow | `instruction/workflow.md` |
| Get the naming rules | `instruction/naming-convention.md` |

---
AgentFlow Nebula · v2.0.0
