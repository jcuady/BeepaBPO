# Beepa documentation

Index for the Beepa BPO platform (`beepabpo.com`): Next.js App Router + Supabase Auth/RLS/Postgres.

## Guides

| Doc | Purpose |
|-----|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Stack, folders, request flow, auth model, deepening opportunities |
| [ROLES_AND_PAGES.md](./ROLES_AND_PAGES.md) | Demo roles, login paths, nav trees, forbidden areas |
| [ROUTES.md](./ROUTES.md) | Every `/app/*` route: guards, data sources, actions |
| [PERMISSIONS.md](./PERMISSIONS.md) | Role × module permission matrix |
| [DATABASE.md](./DATABASE.md) | Schema domains, helpers, indexes, RLS isolation |
| [WORKFLOWS.md](./WORKFLOWS.md) | Onboarding, attendance, leave, NTE, ATS stage moves, billing |
| [SECURITY.md](./SECURITY.md) | Auth, secrets, RLS, `safeNext`, audit policy |
| [PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md) | Web push pipeline, SW cache policy, device runbook |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Env vars from `.env.example` |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Vercel + Supabase, migrations, seed, cron, CI |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Tokens, fonts, app UI primitives, motion, touch, and the gate that enforces them |
| [TESTING.md](./TESTING.md) | Vitest + Playwright |
| [TEST_PLAN.md](./TEST_PLAN.md) | Full release gate (automated + manual + backlog) |
| [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) | Live demo order and landmines to avoid |
| [QA_CHECKLIST.md](./QA_CHECKLIST.md) | Automated vs manual QA |
| [ROLE_CHECKLIST.md](./ROLE_CHECKLIST.md) | Per-role manual walkthrough |
| **[REMAINING_WORK.md](./REMAINING_WORK.md)** | **What is still needed to finish, in the order it should be done** |
| [COMPLETION_LEDGER.md](./COMPLETION_LEDGER.md) | Living principal QA progress + role matrix |
| [SYSTEM_AUDIT.md](./SYSTEM_AUDIT.md) | Principal audit P0–P2 + deferred |
| [PAGE_INVENTORY.md](./PAGE_INVENTORY.md) | Generated map of every route, its gates, and its actions |
| [CHANGELOG.md](./CHANGELOG.md) | Build phases |

## Start here

1. [PROJECT_STATUS.md](../PROJECT_STATUS.md) — current gate numbers and what is blocked.
2. [REMAINING_WORK.md](./REMAINING_WORK.md) — the ordered list of what to do next.
3. [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) — before changing any UI.
4. [SYSTEM_AUDIT.md](./SYSTEM_AUDIT.md) — for the evidence behind any claim.

## Quick links

- Root [README.md](../README.md) — install, seed, local run
- Demo password: `DEMO_PASSWORD` (see [ENVIRONMENT.md](./ENVIRONMENT.md))
- Unit tests: `pnpm test` · E2E: `pnpm test:e2e`
