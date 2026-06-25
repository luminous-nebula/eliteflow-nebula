# Founder Credentials Checklist

One-time, human-only setup of external accounts and API tokens that the automated
(`Auto=TRUE`) tasks depend on. These are the manual prerequisites kept **off** the dispatch
board (`task.csv`) — personas assume the account + token already exist when they run a
"provision/integrate" task.

**Security rules**
- **Never put secret values in this file.** This file is a checklist only.
- App/runtime secrets live in **GCP Secret Manager** (project `luminous-nebula`).
- CI auth is **keyless** via Workload Identity Federation — no long-lived key is stored in
  GitHub. Only non-OIDC values (if any) go in **GitHub repo secrets**.
- When a credential is needed, create the secret in GCP Secret Manager and grant the CI
  service account `secretmanager.secretAccessor` (already provisioned by the Terraform).

Legend:
- [ ] to do 
- [x] done · **Unblocks** = the task(s) waiting on it.

---

## A. Foundation (do first — gates the whole pipeline)

- [x] **GCP project** `luminous-nebula` exists with billing enabled.
- [x] **GitHub repo** `luminous-nebula/gensaas-nebula` created. — *Unblocks `PH45-PD00-T0004` (done)*
- [ ] **Run `terraform apply`** from `infra/` (`gcloud auth application-default login` → `terraform init` → `terraform apply`). Provisions WIF, Artifact Registry, and the CI service account. — *Unblocks `PH46-PD00-T0002`, then the CI/CD workflow `PH46-PD00-T0003`*
- [ ] **Anthropic API key** (for Haiku narration/generation) → store in GCP Secret Manager. — *Unblocks `PH08-PD02-T0002`, Forge generation tasks*

## B. Shared observability (needed early, used by every product)

- [ ] **Sentry** account + project DSN → GCP Secret Manager. — *Unblocks the "Integrate Sentry and PostHog" tasks*
- [ ] **PostHog** account + project API key → GCP Secret Manager.

## C. Billing (before any launch/billing task)

- [ ] **Paddle** Merchant-of-Record account approved. — *Unblocks every "Integrate Paddle…" task*
- [ ] Per product, **Paddle product + pricing + tax** configured (these are already `FALSE` tickets: `PH36-PD08-T0004`, `PH33-PD07-T0002`, `PH08-PD02-T0005`, `PH41-PD09-T0003`, `PH13-PD03-T0002`, `PH19-PD04-T0001`, `PH44-PD10-T0003`).

## D. Per-product accounts (create as each project's phase approaches)

**PD08 — Lumino SOC Audit**
- [ ] Supabase account + project + service key → Secret Manager. — *Unblocks `PH34-PD08-T0002`*
- [ ] GitHub App registered (SOC Audit). — *`PH34-PD08-T0005`*

**PD07 — Lumino DB MigraTest**
- [ ] Neon account + API key → Secret Manager. — *Unblocks `PH30-PD07-T0002`*
- [ ] GitHub App registered (MigraTest). — *`PH30-PD07-T0004`*

**PD02 — Lumino Sentinel**
- [ ] Supabase project + service key → Secret Manager. — *`PH04-PD02-T0002`*
- [ ] Fly.io account + deploy token → Secret Manager. — *`PH07-PD02-T0001`*
- [ ] GitHub App registered (Sentinel). — *`PH05-PD02-T0002`*

**PD09 — Lumino API Drift Monitor**
- [ ] (Uses shared CI/telemetry; no new account beyond GitHub Marketplace listing.)

**PD03 — Lumino JUnit Forge**
- [ ] Extend Sentinel GitHub App scopes for Forge. — *`PH10-PD03-T0001`*

**PD04 — Lumino Full Forge** *(gated until ≥ $1,500 MRR)*
- [ ] Neon (orchestrator persistence) + Fly.io (LangGraph machine) tokens → Secret Manager. — *`PH14-PD04-T0001`, `PH14-PD04-T0004`*

**PD01 — Lumino Newsletter**
- [ ] Beehiiv account + custom-domain DNS configured. — *`PH00-PD01-T0003`*
- [ ] Beehiiv ↔ Paddle MoR integration. — *`PH01-PD01-T0004`*

---

*Maintained by Mensa Nebula. As phases approach, Mensa flags the relevant items here at
standup; the founder checks them off before the dependent `Auto=TRUE` task is dispatched.
A blocked auto-task sits in `blocked` status until its item here is done.*
