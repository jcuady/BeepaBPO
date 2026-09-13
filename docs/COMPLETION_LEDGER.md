# Completion ledger — Principal QA campaign

**Started:** 2026-09-13  
**Last updated:** 2026-09-13  
**Campaign status:** PARTIAL — Prompt 1–5 executed; continue until live ROLE_CHECKLIST + full e2e/viewport verified on production

## Done criteria (100%)

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Role × page truth for all 14 seeded roles | **PASS** (code + docs synced) |
| 2 | Critical workflows documented with pass/fail | **PASS** (documented; live smoke partial) |
| 3 | No open P0/P1 | **PASS** (High portal/dual-membership bugs fixed this campaign) |
| 4 | UI consistency on audited hubs | **PASS** with named Low polish debt |
| 5 | Automated gates green | **PASS** (`pnpm typecheck`, `pnpm test` 179+) |
| 6 | PROJECT_STATUS honest | **PASS** → DEMO-READY / PARTIAL ops |

**Overall toward 100%:** ~85% — remaining is live manual ROLE_CHECKLIST + full Playwright e2e + viewport matrix on deployed env.

---

## Prompt log

### Prompt 1 — Foundation + critical path (2026-09-13)

**Gates:** `pnpm typecheck` PASS · `pnpm test` 43 files / 184 tests PASS · `pnpm test:e2e` **BLOCKED** (DEMO_PASSWORD not set in this environment)

**Find-bugs (High fixed):**

| Severity | Issue | Fix |
|----------|-------|-----|
| High | Client billing detail ignored `allow_billing_view` | `app/app/client/billing/[id]/page.tsx` → `notFound()` |
| High | Client requests listed tickets when ticketing off | Early empty + nav `portalFlag: allowTicketing` |
| High | Client timesheets URL bypass when approval off | Early empty state |
| High | Client approvals showed queue when flag off | Early empty state |
| High | Dual internal+client blocked “Send to client” | `submitTimesheetForClientReview` allows `isInternal` |
| Medium | Payroll/clients/admin actions lacked `isInternal` | Defense-in-depth gates added |

**Critical workflow smoke (code/path verification):**

| Role | Landing | Workflow | Result |
|------|---------|----------|--------|
| Sales | `/app/crm` | CRM hub triage → leads/deals | PASS (gates + CrmPage) |
| Marketing | `/app/cms` | CMS + CRM/tickets nav | PASS |
| Employee | `/app/my` | Attendance/leave self | PASS (segment) |
| Client admin | `/app/client` | Tickets/billing/timesheets flags | PASS after fixes |
| Applicant | `/app/applicant` | Apps only, no ATS | PASS |
| Owner | `/app/dashboard` | system.manage | PASS |

### Prompt 2 — Internal staff deep walk (2026-09-13)

Documented in [ROLE_CHECKLIST.md](./ROLE_CHECKLIST.md) + matrix below. Page gates use `requireInternal` on HR/payroll/employees/leave/attendance/corrections/cash-advances/NTE. Approvals nav requires specific approve codes (not bare `approvals.act`).

### Prompt 3 — CRM / tickets / clients / CMS (2026-09-13)

Staff ticket SELECT/UPDATE requires `is_internal_user()` (migration `…160000`). CRM/tickets/CMS/billing actions require `isInternal`. SLA requires `tickets.manage` AND `clients.manage`. Silent `.limit` on lists — accepted debt until pagination UI.

### Prompt 4 — Client + applicant portals (2026-09-13)

Portal flags enforced on tickets, requests, billing list+detail, timesheets, approvals. Applicant: no `recruitment.read`. Segment layouts isolate trees.

### Prompt 5 — Owner/admin + release gate (2026-09-13)

Admin orgs/workflows remain **view-only by design**. Reports export requires internal + `reports.export`. Automated unit gates green. Full e2e + viewport = **NEEDS VERIFICATION** on CI/local with `DEMO_PASSWORD`.

---

## Role × page matrix (seeded demo roles)

| Role | Landing | Should see | Must NOT see |
|------|---------|------------|--------------|
| owner | `/app/dashboard` | Admin + nearly all hubs | CMS (no `cms.manage` seed) |
| super_admin | `/app/dashboard` | Admin + Reports | HR/CRM/Payroll hubs |
| hr | `/app/my` | HR, NTE, Corrections, Approvals, Reports | Payroll, CRM, CMS, SLA |
| recruiter | `/app/my` | Recruitment, Reports | Staff tickets org-wide unless granted |
| sales | `/app/crm` | CRM, Clients read, Tickets, Reports | SLA, CMS, Payroll |
| marketing | `/app/cms` | CMS, CRM, Tickets, Reports | Clients, SLA |
| operations | `/app/my` | Clients, Tickets, Reports | Approvals nav (no specific approve codes) |
| account_manager | `/app/my` | Clients read, Tickets, Reports | No demo user |
| team_lead | `/app/my` | Approvals, Corrections, Reports | CRM/CMS |
| finance | `/app/my` | Payroll, Billing, Approvals, Reports | CRM/CMS |
| employee | `/app/my` | My Workspace only | Admin hubs / Approvals nav |
| client_admin | `/app/client` | Portal (+ flags) | `/app/my`, staff tickets |
| client_viewer | `/app/client` | Read-leaning portal | Approvals, billing if no perm/flag |
| applicant | `/app/applicant` | Applications, profile | ATS `/app/recruitment` |

Source: `lib/auth/landing.ts`, `lib/app/navigation.ts`, seed SQL, page `requireInternal`.

---

## Open debt (non-blocking)

| Item | Priority | Notes |
|------|----------|-------|
| Live ROLE_CHECKLIST walk | QA | Manual on beepabpo.com |
| Full `pnpm test:e2e` | QA | Needs DEMO_PASSWORD + seeded DB |
| Viewport matrix 375–1920 | QA | Marketing + app shell |
| Silent list `.limit` → pagination UI | P2 | CRM/tickets/clients |
| Owner/Reports KPI targets | P2 | Dashboard Spec Grill |
| OAuth / FTS / announcements | DEF | Explicit defer |
| Org/workflow CRUD | DEF | Keep RO |
| Serwist browserslist audit | Ops | Transitive |
| Supabase leaked-password advisor | Ops | Dashboard |

---

## Closing gate

**Continue — not 100%:** next focus = run `pnpm test:e2e` with demo seed + complete live [ROLE_CHECKLIST.md](./ROLE_CHECKLIST.md) on production, then flip PROJECT_STATUS to READY.
