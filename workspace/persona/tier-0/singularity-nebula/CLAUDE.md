# CLAUDE.md — Project Context & Onboarding

> **You are reading this in a fresh session with no prior memory.** This file is the
> handoff from earlier sessions. Read it top to bottom before doing anything else, then
> follow the "Start here" checklist. The user expects you to rebuild context from this
> file step by step.

---

## ▶ Start here (do these in order, every new life)

1. **Confirm where you are.** The main working folder is the GenSaaS AgentFlow Nebula
   instance. After the planned rename it lives at:
   `<base-path>`
   (it was previously `...\agentflow-nebula`). If only the old path is mounted, ask the
   user which is current.
2. **Use the right tools for this folder (critical).** It is on Google Drive (G:). The
   `mcp__workspace__bash` mount of G:\ is **stale and write-isolated** — it has shown
   empty folders that were actually full, and `cp`/`rm` against it do not reach the real
   Drive. **Always use the host tools (Read, Write, Edit, Glob, Grep) for anything under
   G:\.** Local `C:\` paths (the template repo) behave normally in bash.
3. **If `Read` glitches on a CSV** ("file has 1 lines" / empty output), the file is not
   necessarily empty — fall back to `Grep` with pattern `.` (and `output_mode:"content"`
   or `"count"`) to see real contents. Empty files truly return no matches.
4. **Deleting on the Drive** needs the `mcp__cowork__allow_cowork_file_delete` tool, then
   `rm` via bash — but note bash often can't even see Drive files, so deletion may not be
   possible from the sandbox (tell the user to delete manually).
5. **Rebuild context** by reading: this file, then `README.md`, `docs/user-guide.md`,
   `instruction/instruction.md`, `instruction/naming-convention.md`, and
   `database/schema.json`. Skim `database/**/*.csv` for current data.
6. **Verify current state** before acting (Glob the folder; Grep the CSVs). Then ask the
   user what they want to do next, or pick up from "Open items" below.

---

## What this project is

**AgentFlow Nebula** is a file-based system for running a team of AI "nebula" personas
over a shared workspace. Structured data lives in CSV tables (`database/`); identity and
process live in markdown. A Tier-0 persona, **Singularity Nebula**, keeps it organized.

This folder is the **GenSaaS Nebula** instance of it (config `project-name = GenSaaS
Nebula`). It was brought up to the **v2.0.0** standard and mirrors the template's
structure exactly; only instance data (config) differs.

## Folder & repo map

| What | Path |
|---|---|
| Main working folder (this instance) | `<base-path>` (renamed from `agentflow-nebula`) |
| Canonical template (git repo, branch `common`) | `<template-path>` |
| Empty sibling source-code folder (not yet scaffolded) | `<source-code-path>` |
| Other reference instance (do not modify; treat as example) | `<reference-instance-path>` (the `luminous-forge` instance) |
| GitHub repo for this folder | `gensaas-agentflow-nebula` (being created via GitHub Desktop) |

## Conventions (important — differs from the original template default)

- **kebab-case** for files, folders, ids, and **id values inside cells** (`tier-0`, `t-001`).
- **CSV column headers use Title Case With Spaces** (e.g. `Persona Id`, `Team Id`,
  `Assignee Persona Id`). This is a deliberate choice; the C:\ template was also upgraded
  to match. Full rules: `instruction/naming-convention.md`.
- Dated/archived files: `YYYY-MM-DD_<kebab-name>[-v<n>].<ext>`, moved to `output/archive/`.
- Non-destructive: never hard-delete; archive instead.

## What was done over previous sessions (history)

1. Discovered this folder was a half-built v1 instance (not empty — the stale bash mount
   misled an earlier pass). Corrected course; reverted a bad `cp`.
2. Switched CSV column headers to **Title Case With Spaces**; authored `schema.json` and
   `naming-convention.md`.
3. Upgraded the **C:\ template** to Title-Case headers + v2.0.0 schema (git changes left
   for the user to commit; cleared a stale `.git/index.lock` that blocked committing).
4. **Synced this folder from the upgraded template**: added `docs/`,
   `output/{archive,log,report}`, `project/`, `persona/revenue` + `persona/production`
   tiers; filled all empty narrative files; seeded tables (4 teams, 8 roles, 3-persona
   roster singularity/giga/carina, 7 task statuses, 12 months, prompt-helpers, scheduled
   tasks, task-plans). Kept the GenSaaS `config.csv` (added `timezone`, `created-date`).
5. Archived the old v1 singularity persona to
   `output/archive/2026-06-05_singularity-nebula-v1.md`.
6. Tightened `.gitignore` (ignores `desktop.ini`, `.archived`, `.log`, `.report`).

## Open items / next steps

- [ ] **After the folder rename**, update `database/config/config.csv` `base-path` to
  `<base-path>`.
- [ ] Delete the three legacy hidden folders `.archived\`, `.log\`, `.report\` (empty,
  only `desktop.ini`) — must be done manually in Windows/Drive; the sandbox can't.
- [ ] Finish git setup: init + commit + publish this folder as GitHub repo
  `gensaas-agentflow-nebula` (see the user's GitHub Desktop steps).
- [ ] Optional: scaffold the empty `C:\...\luminous\gensaas-nebula` source-code folder
  from the template; commit the pending C:\ template changes.
- [ ] Optional: add a `.gitattributes` (`* text=auto`) to silence LF→CRLF warnings.

---
*Maintainer note: keep this file current at the end of each working session so the next
life starts informed. Last updated 2026-06-05.*
