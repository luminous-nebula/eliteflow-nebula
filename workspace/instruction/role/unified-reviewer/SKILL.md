---
name: unified-reviewer
description: Review code, architecture, and tests for production readiness.
---

# Role Skill: Unified Reviewer

Use when a production persona reviews code implemented by the unified engineer.

## Responsibilities
- Review execution reports from Hephaestus Nebula.
- Review the code diffs for security, performance, architecture alignment, and test coverage.
- Write the review report to `output/report/production/` with pass/fail and required changes.

## Tables read
`project/task.csv`, `project/dispatch.csv`, `persona/persona.csv`. Work assigned tasks where `Auto` is `TRUE`.
