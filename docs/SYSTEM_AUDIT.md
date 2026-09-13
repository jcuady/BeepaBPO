# System Audit

## Summary

- **Audit date:** 2026-09-13 (Principal completion QA campaign Prompt 1–5)
- **Branch:** `main`
- **Framework:** Next.js 16 App Router + React 19 + Supabase Auth/RLS
- **Live:** https://beepabpo.com · DB `nwvnawgxkzwiercllgmg`
- **Build status:** NEEDS VERIFICATION this session (typecheck/test PASS)
- **Test status:** Vitest PASS (portal-flag + prior RBAC suites)
- **OAuth:** Deferred (email/password only)
- **Decision:** Admin **orgs / workflows stay view-only** (no CRUD)
- **Ledger:** [COMPLETION_LEDGER.md](./COMPLETION_LEDGER.md)

## Critical Issues

| Severity | Area | Issue | Status |
|----------|------|-------|--------|
| P0 | — | None | Clear |
| P1 | Client portal | Billing detail / requests / timesheets / approvals ignored portal flags | **Fixed** 2026-09-13 |
| P1 | Attendance | Dual membership blocked Send to client | **Fixed** 2026-09-13 |
| P1 | RBAC | Client tickets.read / applicant recruitment.read | **Fixed** earlier (`…150000`) |
| P1 | Tickets RLS | Staff org-wide SELECT without internal | **Fixed** (`…160000`) |

## Functional Issues

| Page/Feature | Problem | Fix | Verified |
|--------------|---------|-----|----------|
| `/app/client/billing/[id]` | Flag bypass | `notFound` when billing off | Unit seam |
| `/app/client/requests` | Tickets when flag off | Empty + nav portalFlag | Unit seam |
| `/app/client/timesheets` | Data when approval off | Early empty | Unit seam |
| `/app/client/approvals` | Queue when approval off | Early empty | Unit seam |
| `submitTimesheetForClientReview` | Dual membership fail | Allow `isInternal` | Unit seam |
| Payroll/admin/clients actions | No `isInternal` | Staff access gate | Unit seam |

## Missing / deferred

| Area | Priority | Notes |
|------|----------|-------|
| Live ROLE_CHECKLIST | QA | Manual |
| Full Playwright e2e + viewport | QA | Pre-launch |
| Real FTS search | DEF | Cmd+K nav-only |
| Announcements CMS | DEF | |
| Social OAuth | DEF | |
| List pagination UI | P2 | Silent `.limit` |
| Owner KPI targets | P2 | Dashboard Spec Grill |
| Serwist browserslist | Ops | |
| Supabase leaked-password | Ops | |

## Full next-steps plan

1. Live ROLE_CHECKLIST on demo roles.  
2. `pnpm test:e2e` + viewport matrix.  
3. Flip PROJECT_STATUS to READY when those pass.  
4. Keep OAuth/FTS/org CRUD deferred unless requested.
