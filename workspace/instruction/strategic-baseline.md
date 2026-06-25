# Luminous Nebula — Strategic Baseline (Lean Digest)

**Purpose.** The current strategic decisions that govern the build — read this for live
context. Superseded and historical decisions (the digest of the previous-version reports)
live in `instruction/decision-history.md`.

**Last updated:** 2026-06-10.

---

## Read-first: current strategic baseline

The live decisions that govern the build. If you read nothing else, read these.

- **Business shape — pure product, not services.** Manual-service income lines were removed; all hours go to product + sales/content. Cash-flow targets are canonical in `database/cashflow/` (don't embed numbers here); the current conservative P40 plan shows break-even ~W22 and max drawdown ~$1.06K including LLM/token costs.
- **Billing — Paddle as Merchant of Record** for all paid SaaS; Newsletter on Beehiiv; auth via Supabase Auth. Defer Stripe Direct until incorporated AND >$20K MRR.
- **Product names (authoritative):** see `database/project/project.csv` — the rebrand to the **`Lumino`** prefix is canonical there (Lumino Sentinel, Lumino JUnit Forge, Lumino Full Forge, plus the newer Lumino SOC Audit, Lumino DB MigraTest, Lumino API Drift Monitor, Lumino Boilerplate Reduct, Lumino Newsletter). Don't retro-edit older docs.
- **Sequencing — multi-product portfolio, single-product attention.** One primary product per phase, rest in maintenance. True parallel work is not viable at 40 hrs/wk capacity. Sentinel is the wedge; Full Forge deferred to month 6+ behind a ≥$1,500 MRR gate.
- **Capacity baseline:** 40 hrs/wk split ~22 eng / 8 sales / 5 content / 3 CS / 2 ops. Cloud ceiling ~$35/wk. Binding constraint is sales/market, not engineering.

## Living conventions (permanent reference)

- **Monorepo** at `<source-code-path>` (Turborepo + npm workspaces, one repo). Branching/commit/PR rules, per-persona ownership, PRs <400 lines, single reviewer (Doradus Nebula).
- **Design/code split:** design artifacts → `design/`; code artifacts → `packages/shared-ui/src/`; Figma cloud indexed via `design/figma-index.md`. WCAG 2.2 AA, 44×44 tap targets.
