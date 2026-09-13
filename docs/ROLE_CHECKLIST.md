# Role × surface checklist (Beepa)

**Updated:** 2026-09-13  
**DB:** `nwvnawgxkzwiercllgmg` (linked)  
**Use:** Manual QA / demo walkthrough. Mark each box after verifying in the live app.  
**Living progress:** [COMPLETION_LEDGER.md](./COMPLETION_LEDGER.md)

**Live automation (2026-09-13):** `PLAYWRIGHT_BASE_URL=https://beepabpo.com` · `e2e/roles.spec.ts` — all 13 demo landings + segment isolation + open-redirect block PASS.

Legend: **OK** wired · **GAP** honesty issue · **RO** intentional read-only · **DEF** deferred · **FIX** fixed in code (verify live)

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

---

## Employee (`/app/my`)

| Check | Status |
|-------|--------|
| Clock in/out | OK |
| Leave / cash advance / tickets / payslip | OK / Live |
| Settings password | OK |

---

## Sales / Marketing

| Check | Status |
|-------|--------|
| Sales → `/app/crm` workbench | OK |
| Marketing → `/app/cms` | OK |
| Staff tickets; SLA hidden without clients.manage | OK |

---

## Client Admin / Viewer

| Check | Status |
|-------|--------|
| Ticketing / billing / timesheet flags hard-block | FIX |
| Cannot open staff `/app/tickets` | OK |
| Viewer: no Approvals without approve perms | OK |

---

## Applicant

| Check | Status |
|-------|--------|
| Applications + profile only | OK |
| No ATS `/app/recruitment` | FIX |

---

## Sign-off

After live walkthrough, update [COMPLETION_LEDGER.md](./COMPLETION_LEDGER.md) and [PROJECT_STATUS.md](../PROJECT_STATUS.md).
