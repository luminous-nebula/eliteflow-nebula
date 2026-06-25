# Luminous Nebula — Decision History

**Purpose.** A record of superseded and historical decisions — the conclusions of the
previous-version reports, kept so the *why* survives after the raw reports are cold-archived.
For current decisions, read `instruction/strategic-baseline.md`. Raw original reports are
preserved under `archived/` (cold storage; not migrated).

---

## Archived reports — key conclusions

Listed newest-first within each group. Status notes indicate what is current vs superseded.

### Architecture
- **ADR-0003 — Staging exposure / Cloud Run auth boundary (2026-06-17).** Gated staging Cloud Run services (using `--no-allow-unauthenticated`) to prevent public access, resolving config drift from the internal host assumption. Maintained production as public (`--allow-unauthenticated`). Authorized access via GCP IAM + OIDC authenticated shell proxy. *Status: Ratified.*
- **ADR-0002 — Branch-scoped Workload Identity Federation (2026-06-17).** Hardened the WIF trust relationship in GCP to restrict IAM service account impersonation specifically to the repository's `main` and `staging` branches. *Status: Ratified.*
- **ADR-0001 — Package manager for the Lumino monorepo (2026-06-16).** Ratified npm workspaces instead of pnpm for monorepo package management due to bootstrap status and development capacity constraints. *Status: Ratified.*
- **Architecture baseline (executive red-team rebuttal).** Verdict: "strategically correct but operationally fictional." Move orchestrator off Workers → Fly.io; single-agent MVP; pay for Neon Pro; Testcontainers local; OSS CLI wedge first; run kill-experiments before building. Real burn ~$20-48/wk. *Status: architecture conclusions still cited; timeline superseded by 40-hr rebaseline.*
- **Architecture baseline (founding vision).** Cloudflare Workers + LangGraph.js + Supabase pgvector + E2B, Spring Boot 4.0 / Java 25 upgrade agent. *Status: superseded/rebutted on hosting, dual-agent timing, budget, and timeline.*

### Strategy & product mix
- **Foundation automation setup before launch.** Week-0 (~16 hrs) tooling: Turborepo+pnpm, GitHub Actions, Vercel + Supabase Pro, Doppler, Biome, Sentry/PostHog/Better Stack. ~$25-52/mo. *Status: current — source for the monorepo conventions.*
- **Five products in parallel concerns.** Running 5 products in parallel = 1.5-1.75× over-committed; context-switch loss 20-40%. Adopt single-product attention. *Status: current operating model.*
- **Luminous Score red-team & portfolio fit.** Score (Chrome trust-scorer) is competent but B2C with no synergy to B2B; pause after Phase 0 or cap 6-10 hrs/wk; best repurposed as a developer-trust funnel. *Status: reference.*
- **Capacity rebaseline 40 hrs/week.** Founder capacity 8→40 hrs/wk; 5× hours ≠ 5× success. 22/8/5/3/2 split; $35/wk ceiling. Open question: side-hustle vs full-time. *Status: current timeline baseline.*
- **Sequenced build plan.** Shared chassis once → Sentinel → JUnit Forge → Full Forge with go/no-go gates. *Status: adopted; hours superseded by 40-hr rebaseline.*

### Cash-flow model lineage (each supersedes the prior)
- **v2 pure product.** Services removed. Break-even ~W11-12; W30 cumulative ~$45.6K / MRR ~$19.2K; max drawdown ~$450. *(Historical. Superseded by v3→v5; the canonical live model is now `database/cashflow/` (transposed CSV) + `database/cashflow/Lumino-cashflow-model.xlsx` — current P40 plan: break-even ~W22, drawdown ~$1.06K incl. LLM costs.)*
- **v1 services-funded.** 30 wks. W30 cumulative ~$197.6K / MRR ~$23.4K. *Status: superseded by v2.*

### Channels & GTM
- **Prospect channels / conversion strategy.** Three buyer personas (AppSec / VPE / Practitioner) with per-persona playbooks; 25 LinkedIn DMs/wk for 16 wks. Min comms stack $80-120/mo; CAC ~$1.2-1.5K cold vs $200-400 warm. *Status: persona framework reused; pre-dates the services→pure-product pivot.*

### Memos & org
- **Product renames** — the authoritative rename (see "Product names" in `strategic-baseline.md`). Open question: keep "Luminous Forge" as company name or collapse to Luminous Nebula.

---

## Supersession map (quick reference)

- **Architecture:** founding baseline → rebutted by executive red-team → timeline updated by 40-hr rebaseline.
- **Cash-flow:** v1 (services) → v2 (pure product) → v3 → v4/v4.1 → v5 (Paddle) → **P40 plan (current, in `database/cashflow/`)**.
- **Strategy:** services-funded "Strategy B" → reversed by v2 pure-product. Channels report assumes services still exist — read with that caveat.
- **Naming:** anything before 2026-05-29 uses old product names; the rename memo is authoritative.
