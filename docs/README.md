# Beepa documentation

Index for the Beepa BPO platform (`beepabpo.com`): Next.js App Router + Supabase Auth/RLS/Postgres.

**One subject, one authority.** This repository has 24 documents here plus five at the root,
~600KB in total. The reader's real problem is not *finding* a document — it is working out
**which one to believe** when two disagree. Both contradictions found in the 2026-10-15 audit
came from two documents making the same claim:

| Contradiction | What happened |
|---|---|
| Migrations | `audit:migrations` printed **"pending: 4"** from a hardcoded list; this README family said **"zero pending"**. Both confident; one was a stale constant. |
| Sitemap | `QA_REPORT.md` concluded the defect **"does not exist"**, then contradicted itself thirty lines later and contradicted `app/sitemap.ts`. |

If you add a claim about a subject that already has an authority below, edit that document or
say plainly that you are adding a second source. Silent duplication is what produced both.

## Start here

1. **[COMPLETION_MATRIX.md](./COMPLETION_MATRIX.md)** — one row per requirement: what was
   measured, on what, and what is still missing. Keeps *verified today* separate from
   *inherited* from *blocked*.
2. **[FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md)** — what each feature actually does, every
   row backed by a re-runnable check (21 exercises, 480 assertions).
3. **[REMAINING_WORK.md](./REMAINING_WORK.md)** — the ordered list of what to do next.
4. [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) — before changing any UI.

## By subject — the authority for each

| Subject | Authority | Last verified |
|---|---|---|
| Verification coverage | [COMPLETION_MATRIX.md](./COMPLETION_MATRIX.md) | **2026-10-15** |
| Feature behaviour | [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) | **2026-10-15** |
| Gate status | [COMPLETION_LEDGER.md](./COMPLETION_LEDGER.md) | **2026-10-15** |
| Roles and surfaces | [ROLES_AND_PAGES.md](./ROLES_AND_PAGES.md), [ROLE_CHECKLIST.md](./ROLE_CHECKLIST.md) | **2026-10-15** — `audit:role-pages` 222/222 |
| Permission matrix | [PERMISSIONS.md](./PERMISSIONS.md) | **2026-10-15** — `audit:action-rbac` 64/65 |
| Design system | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | **2026-10-15** — `audit:design` exit 0 |
| Database & schema | [DATABASE.md](./DATABASE.md) | **2026-10-15** — 38 migrations, 0 pending |
| Architecture & stack | [ARCHITECTURE.md](./ARCHITECTURE.md) | not re-verified |
| Routes & guards | [ROUTES.md](./ROUTES.md), [PAGE_INVENTORY.md](./PAGE_INVENTORY.md) | inventory is **generated** — do not hand-edit |
| Workflows (product sense) | [WORKFLOWS.md](./WORKFLOWS.md) | not re-verified |
| Testing & release gate | [TESTING.md](./TESTING.md), [TEST_PLAN.md](./TEST_PLAN.md), [QA_CHECKLIST.md](./QA_CHECKLIST.md) | inherited 2026-10-09 |
| Long-form QA history | [QA_REPORT.md](./QA_REPORT.md) | contains one **superseded** section, marked in place |
| System audit | [SYSTEM_AUDIT.md](./SYSTEM_AUDIT.md) | inherited 2026-10-09 |
| Delivery history | [CHANGELOG.md](./CHANGELOG.md) | append-only; do not edit past entries |
| Environment & secrets | [ENVIRONMENT.md](./ENVIRONMENT.md) | inherited |
| Deployment | [DEPLOYMENT.md](./DEPLOYMENT.md) | inherited |
| Security posture | [SECURITY.md](./SECURITY.md) | inherited |
| Push notifications | [PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md) | **keys are not in Vercel — see gaps below** |

**Currency.** Anything not dated 2026-10-15 was last exercised on or before 2026-10-09. Those
results are real, but they are not current evidence. Promoting a six-day-old result into a
today column is how a stale claim becomes a remembered truth.

## The rest of the set

| Doc | Purpose |
|-----|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Stack, folders, request flow, auth model |
| [ROUTES.md](./ROUTES.md) | Every `/app/*` route: guards, data sources, actions |
| [DATABASE.md](./DATABASE.md) | Schema domains, helpers, indexes, RLS isolation |
| [WORKFLOWS.md](./WORKFLOWS.md) | Onboarding, attendance, leave, NTE, ATS, billing |
| [SECURITY.md](./SECURITY.md) | Auth, secrets, RLS, `safeNext`, audit policy |
| [PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md) | Web push pipeline, SW cache policy, device runbook |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Env vars from `.env.example` |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Vercel + Supabase, migrations, seed, cron, CI |
| [TESTING.md](./TESTING.md) | Vitest + Playwright, sign in as anyone, reach any screen |
| [TEST_PLAN.md](./TEST_PLAN.md) | Full release gate (automated + manual + backlog) |
| [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) | Live demo order and landmines to avoid |
| [QA_CHECKLIST.md](./QA_CHECKLIST.md) | Automated vs manual QA |
| [ROLE_CHECKLIST.md](./ROLE_CHECKLIST.md) | Per-role manual walkthrough |
| [REMAINING_WORK.md](./REMAINING_WORK.md) | What is still needed, in the order it should be done |
| [COMPLETION_LEDGER.md](./COMPLETION_LEDGER.md) | Campaign status + gate table |
| [SYSTEM_AUDIT.md](./SYSTEM_AUDIT.md) | Principal audit P0–P2 + deferred |
| [PAGE_INVENTORY.md](./PAGE_INVENTORY.md) | Generated map of every route, its gates and actions |
| [AUDIT-2026-10-06.md](./AUDIT-2026-10-06.md) | Point-in-time full system audit |
| [CHANGELOG.md](./CHANGELOG.md) | Build phases |

## Gaps a reader should not have to discover

- **Web push will not fire in production.** The rotated VAPID keys exist only in local
  `.env.local`; Vercel does not have them. In-app and email-digest delivery are verified — the
  push path is configured correctly and has nowhere to send from.
- **Signup's success path, the admin invite, and password reset are unproven.** Two are behind
  Supabase's signup rate limit; password reset additionally needs a mail provider this
  environment does not have. Their *refusal* paths are proven.
- **SQL grammar has never been validated.** The migration preflight is structural only, and
  says so on every run.

## Quick links

- Root [README.md](../README.md) — install, seed, local run
- [PROJECT_STATUS.md](../PROJECT_STATUS.md) — current gate numbers and what is blocked
- Demo password: `DEMO_PASSWORD` (see [ENVIRONMENT.md](./ENVIRONMENT.md))
- Unit tests: `pnpm test` · E2E: `pnpm test:e2e`