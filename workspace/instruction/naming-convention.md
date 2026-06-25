# AgentFlow Nebula — Naming Convention

One convention, applied everywhere. The goal is portability (scripts, git,
cross-platform) and predictability.

## Core rule
**kebab-case, lowercase, no spaces** for every folder, file, and identifier.
Use `-` to separate words. Use `_` only as documented below.

**Exception — CSV column headers** use **Title Case With Spaces**: every word
starts with a capital letter and words are separated by single spaces
(e.g. `Assignee Persona ID`). This applies to the header row of CSV tables only;
the *values* in `* ID` columns remain kebab-case. The term **ID** is always
written with both letters capitalized (`ID`, never `Id`).

| Item | Pattern | Example |
|---|---|---|
| Folder | `kebab-case` | `executive`, `prompt-helper` |
| Persona id & folder | `<name>-nebula` | `carina-nebula` |
| Persona file | `<persona-id>.md` | `carina-nebula.md` |
| Project id & folder | `kebab-case` | `luminous-forge` |
| Table (CSV) file | `kebab-case.csv` | `task-status.csv` |
| **CSV column header** | **Title Case With Spaces** | **`Assignee Persona ID`** |
| ID value (inside a cell) | `kebab-case` | `tier-0`, `ph-001` |
| Role / SKILL folder | `kebab-case` | `executive-consultant` |

## CSV column headers (Title Case With Spaces)
The header row names each column with capitalized words separated by spaces.
The meaning is unchanged from the kebab-case ids; only the header text differs:

| Concept | Column header |
|---|---|
| persona-id | `Persona ID` |
| assignee-persona-id | `Assignee Persona ID` |
| team-id | `Team ID` |
| sort-order | `Sort Order` |
| output-ref | `Output Ref` |
| persona-file | `Persona File` |

Cell values still follow their own rules: id cells stay kebab-case
(`tier-0`, `t-001`), dates are ISO (`2026-06-05`), free text is prose.
File-reference columns are those whose header ends in `File`, `Folder`, or `Ref`.

## Dated and versioned files
Deliverables and archived files use an ISO date prefix with an underscore separating
the date block from the kebab-case name:

```
YYYY-MM-DD_<kebab-name>[-v<n>].<ext>
2026-06-01_cash-flow-model-v6.xlsx
```

- Date prefix sorts chronologically and is machine-parseable.
- `_` separates the date from the descriptive name; the name itself stays kebab-case.
- Optional `-v<n>` suffix for explicit versions.

## Report files (`output/report/`)
Markdown reports use date + time + author + topic. The time disambiguates same-day
reports; the topic keeps them legible at a glance. This is the **single source** for
report naming — `workflow.md` links here.

```
<YYYY>-<MM>-<DD> <HHMM> <persona-id> <kebab-topic>.md
2026-06-10 1332 carina-nebula bug-management-proposal.md
```

- `<HHMM>` — 24-hour local time (timezone from `config/config.csv`), no separator.
- `<persona-id>` — the author's `Persona ID` from `persona.csv` (e.g. `carina-nebula`).
- `<kebab-topic>` — short kebab-case subject; use `report` when there is no specific topic.
- Intentional exception to the core kebab-case rule (uses spaces and a time component).

## Architecture Decision Records (ADRs)
ADRs live under the owning project and use a sequential 4-digit number per project:

```
project/<project-id>/adr/<NNNN>-<kebab-title>.md
project/PD02/adr/0001-ephemeral-sandbox-runtime.md
```

- `<NNNN>` increments per project (`0001`, `0002`, …); the title stays kebab-case. See Workflow Q.

## Archiving
Superseded files move to `output/archive/` keeping (or gaining) the `YYYY-MM-DD_`
prefix of the date they were archived. Never delete.

## IDs
Most `* ID` cell values are kebab-case and unique within their table. Short sequential
ids use a prefix: `ph-001` (prompt-helper). These are **stable keys** — assigned once and never renumbered when rows are reordered, the same rule as Project/Phase/Task IDs. `scheduled-task.csv` instead uses a descriptive kebab-case `Schedule ID` (e.g. `mensa-weekly-retrospective`), which is likewise unaffected by reordering.

### Project, phase, and task IDs (uppercase running numbers)
These three tables use fixed-width uppercase IDs — an exception to kebab-case — so a Task
ID self-describes its phase and product:

| Table | ID format | Example |
|---|---|---|
| Project (product) | `PD<NN>` | `PD02` |
| Phase | `PH<NN>` | `PH04` |
| Task | `PH<NN>-PD<NN>-T<NNNN>` | `PH04-PD02-T0001` |

`<NN>` is a two-digit running number; `<NNNN>` a four-digit running number. Folder names
derived from these IDs keep the same casing (e.g. `project/PD02/`).
