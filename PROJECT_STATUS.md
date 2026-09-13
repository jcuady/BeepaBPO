# PROJECT_STATUS — Beepa / BeepoBeepa

**Updated:** 2026-09-13  
**Branch:** `main`  
**Overall:** **DEMO-READY / PARTIAL** — product+RBAC hardened; live ROLE_CHECKLIST + full e2e/viewport still required for 100%.

## Health

| Area | Status |
|------|--------|
| Overall | DEMO-READY — High portal/RBAC bugs fixed this campaign |
| Frontend | GOOD — CRM workbench, portal flag locks, requireInternal |
| Backend | GOOD — staff mutations + ticket RLS internal |
| Database | GOOD — linked `nwvnawgxkzwiercllgmg` |
| Testing | PASS — typecheck + vitest (see COMPLETION_LEDGER) |
| CI | Node 22 + pnpm |
| Docs | `docs/COMPLETION_LEDGER.md` is living source of truth |

## Auth

Email/password only. OAuth deferred.

## Highest-value next

1. Live [ROLE_CHECKLIST](docs/ROLE_CHECKLIST.md) on https://beepabpo.com  
2. `pnpm test:e2e` with seeded demo + `DEMO_PASSWORD`  
3. Viewport matrix (375–1920) on marketing + app shell  
4. Ops: Auth leaked-password + Serwist/`browserslist` when available  
5. OAuth / FTS / announcements — deferred  
6. Org/workflow CRUD — **keep RO**

## Demo-safe promise

No known P0/P1 after 2026-09-13 portal-flag + dual-membership fixes. Remaining risk is unverified live e2e/viewport.

## Campaign

See [docs/COMPLETION_LEDGER.md](docs/COMPLETION_LEDGER.md). **Continue — not 100%** until live checklist + e2e pass.
