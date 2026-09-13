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
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Env vars from `.env.example` |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Vercel + Supabase, migrations, seed, cron, CI |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Tokens, fonts, app UI primitives, motion, touch |
| [TESTING.md](./TESTING.md) | Vitest + Playwright |
| [TEST_PLAN.md](./TEST_PLAN.md) | Full release gate (automated + manual + backlog) |
| [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) | Live demo order and landmines to avoid |
| [QA_CHECKLIST.md](./QA_CHECKLIST.md) | Automated vs manual QA |
| [ROLE_CHECKLIST.md](./ROLE_CHECKLIST.md) | Per-role manual walkthrough |
| [COMPLETION_LEDGER.md](./COMPLETION_LEDGER.md) | Living principal QA progress + role matrix |
| [SYSTEM_AUDIT.md](./SYSTEM_AUDIT.md) | Principal audit P0–P2 + deferred |
| [CHANGELOG.md](./CHANGELOG.md) | Build phases |

## Quick links

- Root [README.md](../README.md) — install, seed, local run
- Demo password: `DEMO_PASSWORD` (see [ENVIRONMENT.md](./ENVIRONMENT.md))
- Unit tests: `pnpm test` · E2E: `pnpm test:e2e`
