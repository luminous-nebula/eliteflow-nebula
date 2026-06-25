# AgentFlow Nebula — Workflows

Each workflow names the tables (`database/...`) and files it reads or writes, so the
data lookups stay explicit.

## Workflow A — Run Housekeeping
Trigger: "Run Housekeeping".
1. Scan the workspace for misplaced, misnamed, or orphaned files.
2. Check each against `naming-convention.md` and the expected layout.
3. Propose a move/archive list (source -> destination). Await approval.
4. On approval, move superseded files to `output/archive/` with a `YYYY-MM-DD_` prefix; relocate misplaced files to their correct folder.
5. Never delete. Update any affected `*-ref` columns in the CSV tables.

## Workflow B — Consolidate Reports
Trigger: "Consolidate Reports".
1. Read recent persona outputs from `output/report/` (and any deliverables under `project/<project-id>/`).
2. Synthesize one master markdown summary in `output/report/`.
3. Propose archiving the raw source reports to `output/archive/`. Await approval.

## Report file naming
Markdown reports written to `output/report/` MUST strictly follow the format defined in `naming-convention.md` (the single source of truth).

Use `report` as the topic when there is no specific subject. When a newer report supersedes an earlier one, archive the old file to `output/archive/` (Workflow A).

## Workflow C — Task lifecycle
1. Plan: add a row to `task.csv` with a new `Task ID` (`PH<NN>-PD<NN>-T<NNNN>`), plus its `Project ID`, `Phase ID`, a `Description`, its estimated `Hours`, the `Auto` flag (see "Auto flag" below), and a `Task Type` (`Feature` / `Bug` / `Chore` / `Tech Debt`; default `Feature`).
2. Status flows through the values in `config/task-status.csv`: `backlog -> planned -> in-progress -> blocked? -> review -> done -> archived`.
3. Only statuses listed in `task-status.csv` are valid.
4. Dates (actuals): Mensa stamps `Date Started` (ISO) when a task first enters `in-progress`, and `Date Completed` when it reaches `done`. These actuals pair with `task-plan.csv`'s planned dates for plan-vs-actual velocity in the weekly retrospective.

### Auto flag
The `Auto` column in `task.csv` marks whether a task can be executed by an AI persona.
`TRUE` = an AI persona may pick up and run the task autonomously; `FALSE` = the task
requires the human founder (manual/offline work). Personas only self-assign and execute
tasks where `Auto` is `TRUE`.

## Workflow D — Add a persona
1. Choose a `team-id` from `team.csv` and a `role-id` from `role.csv` (add a role first if needed).
2. Create the folder `persona/<team-id>/<persona-id>/` and the file `<persona-id>.md` (use the singularity persona as the structural reference).
3. Append a row to `persona/persona.csv` with `persona-file` pointing to that markdown.

## Workflow E — Add a project
1. Append a row to `project/project.csv` with a `Project ID` (`PD<NN>`) and `Project Folder` = `project/<project-id>`.
2. Create `project/<project-id>/` with a `project.md` brief.
3. Add phases to `phase.csv`, then tasks to `task.csv`.

## Traditional Workflows (Legacy)

*(Note: These workflows are used when `workflow-name` in `config.csv` is set to `Traditional`.)*

### Workflow F — Dispatch & Execution
Trigger: "Cycle Planning & Dispatch" — Mensa, weekdays before each work cycle. Exact run times live in `database/workflow/scheduled-task.csv` (the source of truth), not here. The legacy per-persona "Morning Commit" step has been removed; blockers are surfaced at the start of each work cycle instead.
1. **Triage & Create:** At each cycle-planning session, Mensa reads new execution reports, architect/QA handoffs, and bug reports in `output/report/` and creates any required tickets in `task.csv` (new `Task ID`, `Task Type`, `Hours`, `Auto`, and dependencies noted in the description / `blocked` status) before assigning. Only Mensa or Singularity write `task.csv`; this is the single place tickets are created — no separate scheduled task.
2. **Plan & Assign:** Mensa reads `task.csv` to determine today's goals and assigns them by writing to `database/project/dispatch.csv`, stamping each row with the current `Cycle No` (1, 2, or 3 — which of the day's three cycle-planning sessions is running).
3. **Execute:** Production personas (Daedalus, Doradus, Quasar, Quadrans, Pictor, Chronos, Cygnus) read `dispatch.csv` on their scheduled cycles. If assigned a task, they execute it. If not, they sleep.
4. **Report:** Upon completion or at the end of a cycle, personas submit their execution reports to `output/report/`.
5. **Consolidate & Update:** Mensa reads the execution reports, consolidates them, and updates the central `task.csv` state. Production personas never write directly to `task.csv`.

### Workflow G — Work Cycle
Trigger: "Work Cycle <n>" (e.g., Work Cycle 3)
1. Read `database/project/dispatch.csv` to find tasks assigned to your Persona ID.
2. If no tasks are assigned, terminate the cycle successfully (sleep).
3. If tasks are assigned, execute them autonomously using your role skills and the context in the `project/` folders.
4. Write execution reports to `output/report/` using the strict naming convention.

### Workflow M — Bug lifecycle
Defects are tracked in `database/project/bug.csv` (owned by Quasar), separate from the dispatch queue. The fix *work* is a normal `task.csv` row tagged `Task Type = Bug` — so **Mensa always dispatches from `task.csv` only; `bug.csv` is never read in the dispatch loop**.
1. **Report:** anyone (Quasar, Doradus, Daedalus mid-build, or the founder) raises a defect via an execution report; Quasar curates it into `bug.csv` with `Status = new`.
2. **Triage:** Quasar (with Mensa at standup) assigns `Severity` (`config/bug-severity.csv`) and accepts -> `Status = triaged` (or `duplicate` / `wont-fix` / `cannot-reproduce`).
3. **Dispatch:** Mensa creates a fix-task in `task.csv` (`Task Type = Bug`), records its `Task ID` in the bug's `Fix Task ID`, and assigns it via `dispatch.csv` like any task.
4. **Fix -> Review -> Verify:** Daedalus fixes (bug `in-progress`) -> Doradus reviews the PR (`in-review`) -> Quasar verifies the defect no longer reproduces (`verifying`).
5. **Close:** Quasar sets `Date Resolved` and `Status = done`.

**Quality gate:** a phase may not move to `done` (or launch) while any `S1` or `S2` bug against it is open. Quasar enforces this at release sign-off.

### Workflow Q — Design Gate (ADR)
Runs **before** a phase's build tasks start, for any phase that introduces a new service, data model, external integration, or security/trust boundary. Pure scaffold/config/launch phases may skip with a one-line note in the dispatch. (A dedicated architecture persona is planned once PD02 Lumino Sentinel begins; until then design is authored by the engineer and gated by review.)
1. **Author (Daedalus):** write a short, one-page ADR under `project/<project-id>/adr/<NNNN>-<kebab-title>.md` — context, the decision, options considered, trade-offs, and impact on the shared chassis.
2. **Review (Doradus):** review the ADR for correctness, security, and consistency with existing decisions *before any code is written*.
3. **Executive review (Carina):** for significant calls — tech selection, security/zero-egress boundaries, cross-product chassis, or anything that moves the cashflow's cost/timeline — Carina critiques the ADR and names the failure points.
4. **Gate:** the phase's build tasks stay `blocked` until the ADR is accepted; record the accepted ADR path in the phase's first build task (or its dispatch instructions). Superseded ADRs are archived per Workflow A; durable architecture conclusions roll up into `instruction/decision-history.md`.
## Modern Workflows

*(Note: These workflows are used when `workflow-name` in `config.csv` is set to `Modern`.)*

### Workflow R — Unified Execution (Hephaestus)
Trigger: "Execution Cycle" (Hephaestus Nebula, via Claude Code CLI).
1. **Read Dispatch:** Check `database/project/dispatch.csv` or `task.csv` for assigned tasks.
2. **Execute:** Complete the feature delivery and testing in one scheduled job.
3. **Report:** Write the execution report to `output/report/production/`.

### Workflow S — Unified Review (Coeus)
Trigger: "Review Cycle" (Coeus Nebula, via Antigravity).
1. **Read Reports:** Review Hephaestus's execution reports in `output/report/production/`.
2. **Review Code:** Verify code changes, architecture alignment, and test coverage.
3. **Report:** Write the review report to `output/report/production/`.

### Workflow T — Infrastructure Request (Singularity)
Trigger: "Nightly Housekeeping & Provisioning" (Singularity Nebula, via Claude Code CLI).
1. **Scan Requests:** Check `output/report/request/` for tasks awaiting approval.
2. **Execute Approved:** If a task is explicitly checked `[x]` by the founder, execute the required infrastructure or system provisioning.
3. **Report:** Write the execution result back to the request document and output a summary to `output/report/tier-0/`.

## Executive & Auxiliary Workflows
## Workflow H — Aggregate Status
Trigger: "Aggregate Status"
1. Read the central state from `database/project/task.csv` and `dispatch.csv`.
2. Identify blocked tasks, overdue deliverables, or unassigned backlog items.
3. Generate a status digest in `output/report/` to inform the executive team.

## Workflow I — Weekly Retrospective
Trigger: "Weekly Retrospective"
1. Review the week's completed tasks in `task.csv` and the execution reports in `output/report/`.
2. Identify bottlenecks, velocity metrics, and workflow failures across the production team.
3. Write a retrospective summary to `output/report/`.

## Workflow J — Executive Review
Trigger: "Executive Review"
1. Read recent status aggregates, production reports, and cash flow assumptions (`database/cashflow/`).
2. Perform executive stress-tests and identify strategic risks or architectural flaws.
3. Output an executive brief to `output/report/`.

## Workflow K — Weekly Strategic Review
Trigger: "Weekly Strategic Review"
1. Read Carina's executive reviews and any market-research / GTM reports in `output/report/`.
2. Evaluate current trajectory against `instruction/strategic-baseline.md`.
3. Make binding strategic decisions and output a strategic directive to `output/report/`.

## Workflow L — Competitor Baseline Scan
Trigger: "Competitor Baseline Scan"
1. Search the web and recent literature for updates on key competitors.
2. Synthesize intelligence briefs highlighting competitor movements and market shifts.
3. Output the brief to `output/report/`.

## Workflow N — Content Cycle
Trigger: "Content Cycle" (Pulsar, marketing-lead).
1. Read `strategic-baseline.md` and Vela's positioning/ICP; read the active product stage from `project.csv`.
2. Produce and publish the planned content in brand voice — Lumino Newsletter issue, launch posts, social, SEO pages — each mapped to a funnel stage.
3. Hand qualified prospects to Sirius; log published items and engagement (reach -> signups -> qualified) and write a content report to `output/report/`.
Guardrails: no unsubstantiated claims, no fabricated quotes; positioning comes from Vela, not invented here.

## Workflow O — Outreach Cycle
Trigger: "Outreach Cycle" (Sirius, sales-lead).
1. Prioritize prospects and design partners per Vela's ICP and channel picks; take warm leads from Pulsar. Prefer warm + marketplace over cold.
2. Run outreach and book/prep discovery conversations; bring deals that need signing or payment to the founder.
3. Capture every prospect/customer signal (objections, feature asks, pricing reactions) into a structured feedback log for Vela; report pipeline commitments (paid pilots, signed deals — not vanity) to `output/report/`.

## Workflow P — Demand & Feedback Synthesis
Trigger: "Demand & Feedback Synthesis" (Vela, gtm-advisor). Cadence: monthly pre-launch; weekly once a product is live; back to monthly at steady state.
1. Read Orion's competitor/market briefs, Sirius's prospect/customer feedback log, product analytics (PostHog), and any churn/support signals.
2. Synthesize into themes; weigh them against `strategic-baseline.md` and the cashflow's demand assumptions (`database/cashflow/`).
3. Write a **Direction & Feature Recommendation** report to the founder in `output/report/`: what to adjust in positioning, pricing, roadmap/features, and channels — each tied to evidence and the decision it informs. Flag anything that should change build priority (`project.csv`) or kill/keep a product.

