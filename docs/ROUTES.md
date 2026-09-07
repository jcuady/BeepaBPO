# Routes

Guards:

- **proxy** — session required for `/app/*`
- **layout** — `app/app/layout.tsx` → `resolveWorkspace` + shell
- **segment** — `my` / `client` / `applicant` membership checks
- **perm** — `requirePermission` or `canAny` → `forbidden()`

Auth and access routes are listed at the bottom.

## Employee self-service (`/app/my/*`)

| Route | Guard | Data | Key actions |
|-------|-------|------|-------------|
| `/app/my` | segment internal | `employees`, attendance, leave balances, shifts, approvals, payroll periods | Clock via attendance actions |
| `/app/my/attendance` | segment | `attendance_records` | `clock_event`, correction request |
| `/app/my/schedule` | segment | `shift_assignments` | — |
| `/app/my/leave` | segment | `leave_types`, `leave_balances`, `leave_requests` | submit / cancel leave |
| `/app/my/payroll` | segment | `payroll_records` (self) | list + PDF via `/app/my/payroll/[recordId]/payslip` |
| `/app/my/nte` | segment | `nte_cases` (self) | respond + view outcome |
| `/app/my/cash-advances` | segment | `cash_advance_requests` | submit cash advance |
| `/app/my/requests` | segment | tickets, cash advances, approvals (own) | — |
| `/app/my/documents` | segment | `documents` + Storage | upload self; signed download (15m) |
| `/app/my/profile` | segment | profile / employee | `updateProfile` |
| `/app/my/notifications` | segment | `notifications`, preferences | mark read, push subscribe |
| `/app/my/support` | segment | — | create ticket (self) |

## Client portal (`/app/client/*`)

| Route | Guard | Data | Key actions |
|-------|-------|------|-------------|
| `/app/client` | segment client | team, approvals, tickets, attendance summary, invoices | — (no SLA tile) |
| `/app/client/team` | segment | `client_visible_employees` | — |
| `/app/client/attendance` | segment | `client_attendance_summary` | filters: `from`/`to`/`status` |
| `/app/client/timesheets` | segment | `client_attendance_summary` | Approve / Send back when `allow_timesheet_approval` |
| `/app/client/performance` | segment | KPIs for visible employees | — |
| `/app/client/requests` | segment | client tickets | create ticket |
| `/app/client/tickets` | segment | `tickets` | — |
| `/app/client/tickets/[id]` | segment | ticket + messages | reply (client-visible) |
| `/app/client/approvals` | segment | `client_review` timesheets | Approve / Send back (`reviewClientTimesheet`) |
| `/app/client/reports` | segment | team + attendance summary | — |
| `/app/client/documents` | segment | client documents + Storage | upload + signed download (needs migration `20260907140000` on Beepa) |
| `/app/client/billing` | segment | `invoices` | list → detail |
| `/app/client/billing/[id]` | segment | invoice + items + payments | read-only detail |
| `/app/billing` | perm `billing.read` | invoices | finance list |
| `/app/billing/[id]` | perm `billing.read` | invoice detail | record payment if `billing.manage` |
| `/app/client/settings` | segment | `client_profiles`, `client_settings` | — |

## Applicant (`/app/applicant/*`)

| Route | Guard | Data | Key actions |
|-------|-------|------|-------------|
| `/app/applicant` | segment applicant-only | `applicants`, `job_applications` | — |
| `/app/applicant/profile` | segment | applicant / profile | profile update |

Public careers apply: marketing `/careers/[slug]` → `applyToJob` (not under `/app`).

Public CMS read: `/about` (settings + industries + testimonials), `/services`, `/resources` + `/resources/[slug]`, `/case-studies` + `/case-studies/[slug]`, `/contact` FAQs.

## Internal hubs and admin

| Route | Guard | Data | Key actions |
|-------|-------|------|-------------|
| `/app` | proxy + layout | — | redirects via `landingPathFor` |
| `/app/dashboard` | perm `system.manage` | memberships, approvals, clients, tickets | — |
| `/app/hr` | canAny employees/leave | employee/leave/attendance counts | links to tools |
| `/app/hr/nte` | perm `nte.read` | `nte_cases`, responses | create; resolve if `nte.manage` |
| `/app/employees` | perm `employees.read` | `employees` | search `q` (DB) |
| `/app/employees/[id]` | perm `employees.read` | employee detail + docs | HR upload if `employees.documents.manage` |
| `/app/attendance` | perm `attendance.read` | `attendance_records` | Send to client (`submitTimesheetForClientReview`) |
| `/app/leave` | perm `leave.approve` | `leave_requests` (filter `status`) | approve/reject (confirm) |
| `/app/cash-advances` | perm `cash_advance.read` | `cash_advance_requests` | review pending/hr_review/finance_review |
| `/app/payroll` | canAny payroll.* | period metrics | link to periods |
| `/app/payroll/periods` | perm `payroll.read` | `payroll_periods` | — |
| `/app/payroll/periods/[id]` | perm `payroll.read` | period + `payroll_records` | recalculate |
| `/app/recruitment` | canAny recruitment.* | job/application counts | — |
| `/app/recruitment/jobs` | perm `recruitment.read` | `job_posts` | create; publish/close; edit at `/jobs/[id]` |
| `/app/recruitment/jobs/[id]` | perm `recruitment.read` | job detail | update form + status actions (`recruitment.manage`) |
| `/app/recruitment/applicants` | perm `recruitment.read` | `job_applications` | filters `q`/`stage` |
| `/app/recruitment/applicants/[id]` | perm `recruitment.read` | application detail | `updateApplicationStage` (confirm) |
| `/app/crm` | canAny crm.* | lead + deal counts | links to leads/deals |
| `/app/crm/leads` | perm `crm.read` | `crm_leads` | create; filters; status update if `crm.manage` |
| `/app/crm/leads/[id]` | perm `crm.read` | lead + activities | status update; open deal if `crm.manage` |
| `/app/crm/deals` | perm `crm.read` | `crm_deals` | create; stage filter; stage update if `crm.manage` |
| `/app/crm/deals/[id]` | perm `crm.read` | deal + activities | stage update if `crm.manage` |
| `/app/clients` | canAny clients.* | client `organizations` + memberships | invite client_admin/viewer if `clients.manage` |
| `/app/tickets` | perm `tickets.read` | `tickets` | status (confirm); filters |
| `/app/tickets/[id]` | perm `tickets.read` | ticket, messages, internal notes | reply, status |
| `/app/reports` | canAny reports.* | workforce/ticket/CRM counts | CSV export if `reports.export` |
| `/app/reports/export` | perm `reports.export` | CSV download (`?dataset=`) | snapshot\|employees\|attendance\|tickets\|leads |
| `/app/cms` | perm `cms.manage` | services, blog, faqs, industries, testimonials, case_studies, site_settings | create drafts; publish/archive; About upsert |
| `/app/approvals` | perm `approvals.act` | `approval_requests` | deep-link Review (no inline act) |
| `/app/admin` | perm `system.manage` | profile/org counts | links to users/orgs/audit |
| `/app/admin/users` | perm `system.manage` | memberships + roles | invite internal + search |
| `/app/admin/organizations` | perm `system.manage` | `organizations` | read-only list |
| `/app/admin/audit` | perm `system.manage` | `audit_logs` | filter `q` |

## Auth and access

| Route | Audience |
|-------|----------|
| `/login` | Client & applicant |
| `/employee/login` | Internal only |
| `/signup` | Public applicant signup |
| `/forgot-password` | All |
| `/reset-password` | All (session from email link) |
| `/verify-email` | Post-signup |
| `/auth/callback` | Code exchange; `safeNext` on `next` |
| `/app/access-denied` | Authenticated, no usable membership |
| `forbidden.tsx` | Permission denial UI |

## API (not pages)

| Route | Auth |
|-------|------|
| `POST /api/jobs/cron` | `Authorization: Bearer $CRON_SECRET` or `x-cron-secret`; body `{ job, dryRun? }` |
| `POST /api/push/subscribe` | Session |
| `POST /api/push/unsubscribe` | Session |
| `POST /api/push/send` | `CRON_SECRET` or `system.manage` |
