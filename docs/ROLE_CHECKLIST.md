# Role × surface checklist (Beepa)

**Updated:** 2026-09-08  
**DB:** `nwvnawgxkzwiercllgmg` (linked)  
**Use:** Manual QA / demo walkthrough. Mark each box after verifying in the live app.

Legend: **OK** wired · **GAP** honesty issue · **RO** intentional read-only · **DEF** deferred

---

## Global (all signed-in app users)

| Check | Status | Notes |
|-------|--------|-------|
| Account menu opens without crash | OK | Base UI `Menu.Group` fix |
| Profile / Settings / Notifications go to real pages | OK | Client/applicant: Settings hidden when same as Profile |
| Search says “Go to a page…” (not entity search) | OK | Command palette = nav only |
| Sign out works | | |

---

## Owner / Super Admin (`/app/dashboard`)

| Check | Status |
|-------|--------|
| Jump-in links match permissions | OK |
| Approvals hub + Payroll periods | OK |
| Admin Users invite | |
| Orgs / Workflows are **view-only** (no edit) | RO | Subtitle honesty + no edit UI |
| CMS hidden for Owner (no `cms.manage`) | OK seed |

---

## Finance

| Check | Status |
|-------|--------|
| Create payroll period | |
| Submit period for approval | OK |
| Approve Finance step | OK |
| Cash advance Finance step | |
| Billing Issue / Record payment | |
| Reports CSV | |

---

## HR / Team Lead

| Check | Status |
|-------|--------|
| Leave approve (current step only) | |
| Attendance corrections | |
| NTE create/resolve (HR) | |
| Cash advance HR step | |
| Employee profile edit UI | GAP (display-only) |

---

## Employee (`/app/my`)

| Check | Status | Notes |
|-------|--------|-------|
| Clock in/out | OK | Location text only (no fake Change location) |
| Leave submit | | |
| Cash advance (needs employee row) | OK gated |
| **Ticket create → open detail → reply** | OK | `/app/my/requests/[id]` |
| Payslip PDF | | |
| Settings password | OK |
| Updates → Notifications | OK | Replaces empty Announcements |

---

## Client Admin

| Check | Status |
|-------|--------|
| Create ticket / reply | |
| Timesheet approve (flag on) | |
| Profile edit + password on Settings | OK |
| Notifications inbox | OK |
| Approvals nav only if permitted | OK filtered |

---

## Client Viewer

| Check | Status |
|-------|--------|
| No Create ticket form | OK |
| No Reply on others’ tickets | OK |
| Approvals link hidden without perm | OK |
| Password change | OK |

---

## Applicant

| Check | Status |
|-------|--------|
| Applications list | RO |
| Profile + password | OK |
| Notifications | OK |

---

## Database health (`nwvnawgxkzwiercllgmg`)

| Check | Status | Notes |
|-------|--------|-------|
| Public tables | 84 | RLS enabled on public tables |
| Tables w/ zero secondary indexes | Improved | `approval_actions`, `role_permissions` indexed |
| Anon EXECUTE on SECURITY DEFINER | Hardened | Migration `20260908120000` |
| Function `search_path` on generators | Hardened | `generate_*_number` |
| Remaining advisor WARNs | Review | authenticated EXECUTE on helpers expected for RLS |

---

## Client portal flags

| Flag | Enforcement |
|------|-------------|
| `allow_timesheet_approval` | Nav + approvals/timesheets (prior) |
| `allow_ticketing` | Nav + tickets page + `createTicket` |
| `allow_billing_view` | Nav + billing page gate |
| `allow_attendance_view` | Nav + attendance page gate |

---

## Still deferred / polish

1. Social OAuth  
2. Admin org/workflow/user edit UIs (orgs/workflows stay RO unless product asks)  
3. Employee record edit form  
4. Hard-lock ticket **reply** when ticketing flag off  
5. Real full-text search  
6. Announcements CMS  
