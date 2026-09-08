# PROJECT_STATUS — Beepa / BeepoBeepa

**Updated:** 2026-09-08  
**Branch:** `main`  
**Overall:** **DEMO-HARDENED / PARTIAL** — principal P0–P2 product/polish clear; ops/QA deferred.

## Health

| Area | Status |
|------|--------|
| Overall | PARTIAL — demos ready; OAuth/FTS/ops deferred |
| Frontend | GOOD — HR edit, admin revoke/role, confirms, portal locks |
| Backend | GOOD — mutations + audit for new slices |
| Database | GOOD — linked `nwvnawgxkzwiercllgmg` |
| Testing | PASS — typecheck/lint/test/build exit 0 (149 tests) |
| CI | Node 22 + pnpm from packageManager |
| Docs | `docs/SYSTEM_AUDIT.md` current |

## Auth

Email/password only. OAuth deferred.

## Highest-value next

1. Manual ROLE_CHECKLIST on live  
2. Ops: Auth leaked-password + Serwist/`browserslist` bump when available  
3. Pre-launch: e2e + viewport matrix  
4. OAuth / FTS / announcements — deferred until asked  
5. Org/workflow CRUD — **decided keep RO**

## Demo-safe promise

No known P0/P1. P2 employee edit, admin role/revoke, destructive confirms, and ticket reply hard-lock shipped. Orgs/workflows remain view-only by design.
