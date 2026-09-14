# System Audit

## Summary

- **Audit date:** 2026-09-14 (Beepa DB indexes/realtime + list pagination)
- **Branch:** `main`
- **Framework:** Next.js 16 App Router + React 19 + Supabase Auth/RLS
- **Live:** https://beepabpo.com · DB `nwvnawgxkzwiercllgmg`
- **Build status:** `pnpm build` PASS this session
- **Test status:** Vitest 192 · Playwright viewport 24 · live roles landings PASS
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
| Client dashboard compile | Orphan query chain | Fixed Promise.all entry | typecheck |
| Unbounded portal/staff lists | TTFB lag risk | `.limit` caps + loading.tsx | code review |
| Silent list caps | No way to see page 2 | URL `page` + ListPager on hot queues | seam tests |
| App shell 2–5s blank | Sequential workspace + invisible skeletons | Parallel RPC + skip unread wait + visible skeletons | typecheck + seam tests |
| Attendance page no clock | Clock card only on `/app/my` | Clock In/Out on `/app/my/attendance` | source scan |

## Missing / deferred

| Area | Priority | Notes |
|------|----------|-------|
| Live ROLE_CHECKLIST | Done | Automated landings on production 2026-09-13 |
| Viewport matrix 375–1920 | Done | `e2e/viewport.spec.ts` 24/24 + marketing overflow-x-clip |
| Real FTS search | DEF | Cmd+K nav-only |
| Announcements CMS | DEF | |
| Social OAuth | DEF | |
| Apply `20260914120000` on prod DB | Done | Applied on `nwvnawgxkzwiercllgmg` (indexes + `supabase_realtime`) |
| List pagination UI | Done | Tickets, employees, CRM leads/deals, leave, applicants, client tickets, admin users |
| Remaining silent `.limit` lists | P2 | Dashboards, CMS, billing, etc. still cap without pager |
| Owner KPI targets | P2 | Dashboard Spec Grill |
| Serwist browserslist | Ops | |
| Supabase leaked-password | Ops | |

## Full next-steps plan

1. Rotate the chat/CLI Supabase access token (it was in session history).  
2. Confirm Vercel picked up this commit on beepabpo.com.  
3. Keep OAuth/FTS/org CRUD deferred unless requested.  
4. Ops hygiene (leaked-password advisor, Serwist) when convenient.
