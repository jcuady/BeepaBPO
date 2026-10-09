# Role × surface checklist (Beepa)

**Updated:** 2026-10-07  
**DB:** `nwvnawgxkzwiercllgmg` (linked)  
**Use:** Manual QA / demo walkthrough. Mark each box after verifying in the live app.  
**Living progress:** [COMPLETION_LEDGER.md](./COMPLETION_LEDGER.md)

Legend: **OK** wired · **GAP** honesty issue · **RO** intentional read-only · **DEF** deferred · **FIX** fixed in code (verify live)

---

## Automation coverage

| Surface | Coverage |
|---------|----------|
| Responsive (390 / 768) | **All 7 demo roles swept.** Run against a production build, never `next dev`. |
| E2E (Playwright) | `owner`, `client`, `anonymous` projects have real specs. Run the projects **sequentially** — several specs sign in as the same demo account and racing them invalidates the shared `storageState`. |
| RBAC routes | `scripts/audit/audit-rbac.mjs` — 73/76 + 3 structural exemptions |
| RBAC actions | `scripts/audit/audit-action-rbac.mjs` — 63/64 |
| Dead controls | `scripts/audit/audit-page-wiring.mjs` — 0 candidates |

Reproduce the sweeps with `scripts/audit-app-responsive.mjs <email> <route...>`.

### Demo login is off in production builds

`getDemoLoginConfig` returns `null` when `NODE_ENV=production` unless
`ALLOW_DEMO_LOGIN=true`, so the demo picker is not rendered at all. That is a
deliberate security choice — a one-click shared-password bypass should never
ship live — and `e2e/demo-login.spec.ts` now **skips with that reason** instead
of failing. Set `ALLOW_DEMO_LOGIN=true` (at build and start) to actually run
those three tests; verified 4/4 pass with it on.

---

## Global (all signed-in app users)

| Check | Status | Notes |
|-------|--------|-------|
| Account menu opens without crash | OK | |
| Profile / Settings / Notifications go to real pages | OK | |
| Search says “Go to a page…” (not entity search) | OK | Cmd+K admin links require `isInternal` |
| Sign out works | OK | Covered by app session flows / e2e logout paths |

---

## Owner / Super Admin (`/app/dashboard`)

| Check | Status |
|-------|--------|
| Jump-in links match permissions | OK |
| Approvals hub + Payroll periods | OK |
| Admin Users invite / role / revoke | OK |
| Orgs / Workflows are **view-only** | RO |
| CMS hidden for Owner (no `cms.manage`) | OK seed |
| Staff pages require internal | OK |

---

## Finance

| Check | Status |
|-------|--------|
| Create payroll period | OK code |
| Submit / approve period | OK |
| Billing issue / record payment | OK code |
| Reports CSV | OK |

---

## HR / Team Lead

| Check | Status |
|-------|--------|
| Leave approve (current step only) | OK code |
| Attendance corrections (internal only) | FIX |
| NTE create/resolve | OK code |
| Employee profile edit | OK |
| Send to client timesheet (dual membership) | FIX |
| Careers: post / advance stages / hire | **was 403** — `hr` had no `recruitment.*`. Fixed by `20261008120000_hr_recruitment_access.sql` (needs DB credentials to apply) |

---

## Employee (`/app/my`)

| Check | Status |
|-------|--------|
| Clock in/out on My Workspace **and** Attendance | OK | Same `ClockInOutCard` + live refresh |
| Leave / cash advance / tickets / payslip | OK / Live |
| Payslip withheld until the period is approved | FIX | List and PDF both gate on period status |
| Settings password | OK |

**Verified sweep:** 7 routes x 390/768 clean. Attendance times render in the employee's own timezone, not the server's.

---

## Client Admin / Viewer

| Check | Status |
|-------|--------|
| Ticketing / billing / timesheet flags hard-block | FIX |
| Cannot open staff `/app/tickets` | OK |
| Viewer: no Approvals without approve perms | OK |
| Notification preference switches meet 44px on touch | FIX |

**Verified sweep:** client admin 10 routes, client viewer 9 routes x 390/768 clean.

---

## Sales / Marketing

| Check | Status |
|-------|--------|
| Sales → `/app/crm` workbench | OK |
| Marketing → `/app/cms` | OK |
| Staff tickets; SLA hidden without clients.manage | OK |

---

## Applicant

| Check | Status |
|-------|--------|
| Applications + profile only | OK |
| No ATS `/app/recruitment` | FIX — still true. The applicant role holds no `recruitment.read` (`20260911150000` removed it deliberately); open roles are reached through the `status = 'published'` RLS policy instead |
| Browse open roles in-app | NEW — `/app/applicant/jobs` + `/app/applicant/jobs/[id]`, apply without leaving the portal |
| Notifications reachable | FIX — the page existed but was not in any nav |
| Stage shown with meaning | NEW — label, tone, applicant note and pipeline position instead of `stage.replace(/_/g," ")` |

**Verified sweep:** 5 routes x 390/768 clean (`/app/applicant`, `/app/applicant/jobs`, `/app/applicant/notifications`, profile, plus the job detail). Live-checked in a browser: role list renders a published role with its "Applied" marker, and the detail page renders the stage explainer.

---

## Sign-off

After live walkthrough, update [COMPLETION_LEDGER.md](./COMPLETION_LEDGER.md) and [PROJECT_STATUS.md](../PROJECT_STATUS.md).
