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
| `/app/my/requests` | segment | tickets, cash advances, approvals (own) | create ticket / cash (if employee) |
| `/app/my/requests/[id]` | segment | own ticket + messages | reply as requester |
| `/app/my/documents` | segment | `documents` + Storage | upload self; signed download (15m) |
| `/app/my/profile` | segment | profile / employee | `updateProfile` |
| `/app/my/settings` | segment | auth user | `changePasswordAction` |
| `/app/my/notifications` | segment | `notifications`, preferences | mark read, push subscribe, email digest pref |
| `/app/my/support` | segment | — | create ticket (self) |

## Client portal (`/app/client/*`)

| Route | Guard | Data | Key actions |
|-------|-------|------|-------------|
| `/app/client` | segment client | team, approvals, tickets, attendance summary, invoices, **SLA compliance** | — |
| `/app/client/team` | segment | `client_visible_employees` | — |
| `/app/client/attendance` | segment | `client_attendance_summary` | filters: `from`/`to`/`status` |
| `/app/client/timesheets` | segment | `client_attendance_summary` | Approve / Send back when `allow_timesheet_approval` |
| `/app/client/performance` | segment | KPIs for visible employees | — |
| `/app/client/requests` | segment + `allow_ticketing` | client tickets | create via tickets when flag on |
| `/app/client/tickets` | segment + `allow_ticketing` | `tickets` + SLA badges | create ticket |
| `/app/client/tickets/[id]` | segment + `allow_ticketing` | ticket + messages + SLA | reply (client-visible) |
| `/app/client/approvals` | segment + `allow_timesheet_approval` | `client_review` timesheets | Approve / Send back |
| `/app/client/reports` | segment | team + attendance summary | — |
| `/app/client/documents` | segment | client documents + Storage | upload + signed download |
| `/app/client/billing` | segment + `allow_billing_view` | `invoices` | list → detail |
| `/app/client/billing/[id]` | segment + `allow_billing_view` | invoice + items + payments | read-only detail |
| `/app/billing` | `requireInternal` + `billing.read` | invoices | issue if `billing.manage`; list |
| `/app/billing/[id]` | `requireInternal` + `billing.read` | invoice detail | record payment if `billing.manage` |
| `/app/client/settings` | segment | `client_profiles`, `client_settings` | change password |
| `/app/client/notifications` | segment | `notifications`, preferences | mark read / prefs |

## Applicant (`/app/applicant/*`)

| Route | Guard | Data | Key actions |
|-------|-------|------|-------------|
| `/app/applicant` | segment applicant-only | `applicants`, `job_applications` | — |
| `/app/applicant/profile` | segment | applicant / profile | profile update + password |
| `/app/applicant/notifications` | segment | `notifications`, preferences | mark read / prefs |

Public careers apply: marketing `/careers/[slug]` → `applyToJob` (not under `/app`).

Public CMS read: `/about` (settings + industries + testimonials), `/services`, `/resources` + `/resources/[slug]`, `/case-studies` + `/case-studies/[slug]`, `/contact` FAQs.

## Internal hubs and admin

| Route | Guard | Data | Key actions |
|-------|-------|------|-------------|
| `/app` | proxy + layout | — | redirects via `landingPathFor` |
| `/app/attendance` | `requireInternal` + `attendance.read` | `attendance_records` | Send to client (`submitTimesheetForClientReview`; dual membership OK if internal) |
| `/app/leave` | `requireInternal` + `leave.approve` | `leave_requests` (filter `status`) | approve/reject only if current-step actor |
| `/app/cash-advances` | `requireInternal` + `cash_advance.read` | `cash_advance_requests` | review only if current-step actor |
| `/app/payroll` | `requireInternal` + payroll.* | period metrics | link to periods |
| `/app/payroll/periods` | `requireInternal` + `payroll.read` | `payroll_periods` | create if `payroll.manage` |
| `/app/payroll/periods/[id]` | `requireInternal` + `payroll.read` | period + `payroll_records` | recalculate; submit; Approve/Reject |
| `/app/recruitment` | `requireInternal` + recruitment.* | job/application counts | — |
| `/app/recruitment/jobs` | `requireInternal` + `recruitment.read` | `job_posts` | create; publish/close; edit |
| `/app/recruitment/jobs/[id]` | `requireInternal` + `recruitment.read` | job detail | update + status (`recruitment.manage`) |
| `/app/recruitment/applicants` | `requireInternal` + `recruitment.read` | `job_applications` | filters `q`/`stage` |
| `/app/recruitment/applicants/[id]` | `requireInternal` + `recruitment.read` | application detail | stage update |
| `/app/crm` | `requireInternal` + crm.* | pipeline workbench | links to leads/deals/proposals |
| `/app/crm/leads` | `requireInternal` + `crm.read` | `crm_leads` | create; filters; status |
| `/app/crm/leads/[id]` | `requireInternal` + `crm.read` | lead + activities | status; open deal |
| `/app/crm/deals` | `requireInternal` + `crm.read` | `crm_deals` | create; stage |
| `/app/crm/deals/[id]` | `requireInternal` + `crm.read` | deal + proposals | stage; convert won |
| `/app/crm/proposals` | `requireInternal` + `crm.read` | `crm_proposals` | create + status |
| `/app/clients` | `requireInternal` + clients.* | client orgs | invite if `clients.manage` |
| `/app/tickets` | `requireInternal` + `tickets.read` | `tickets` + SLA | status; filters |
| `/app/tickets/sla` | `requireInternal` + tickets.manage AND clients.manage | SLA policies | create/update |
| `/app/tickets/[id]` | `requireInternal` + `tickets.read` | ticket detail | assign/status/reply |
| `/app/reports` | `requireInternal` + reports.* | snapshot counts | CSV if export |
| `/app/reports/export` | `requireInternal` + `reports.export` | CSV | datasets capped 2k |
| `/app/cms` | `requireInternal` + `cms.manage` | CMS entities | draft/publish |
| `/app/hr` | `requireInternal` + employees/leave | counts | hub links |
| `/app/hr/nte` | `requireInternal` + `nte.read` | `nte_cases` | create/resolve |
| `/app/employees` | `requireInternal` + `employees.read` | `employees` | search |
| `/app/employees/[id]` | `requireInternal` + `employees.read` | employee detail | edit if manage |
| `/app/dashboard` | `requireInternal` + `system.manage` | org metrics | — |
| `/app/admin` | `requireInternal` + `system.manage` | counts | links |
| `/app/admin/users` | `requireInternal` + `system.manage` | memberships | invite/role/revoke |
| `/app/admin/organizations` | `requireInternal` + `system.manage` | orgs | **RO** |
| `/app/admin/audit` | `requireInternal` + `system.manage` | audit_logs | filter |
| `/app/admin/workflows` | `requireInternal` + `system.manage` | workflows | **RO** |
| `/app/approvals` | `requireInternal` + specific approve codes | approval_requests | current-step only |

## Auth and access

Email/password only (OAuth deferred). No social provider CTAs.

| Route | Audience |
|-------|----------|
| `/login` | Client & applicant (email/password) |
| `/employee/login` | Internal only (email/password) |
| `/signup` | Public applicant signup |
| `/forgot-password` | All |
| `/reset-password` | All (session from email link) |
| `/verify-email` | Post-signup |
| `/auth/callback` | Code exchange; `safeNext` on `next` (magic-link / future OAuth) |
| `/app/access-denied` | Authenticated, no usable membership |
| `forbidden.tsx` | Permission denial UI |

## API (not pages)

| Route | Auth |
|-------|------|
| `POST /api/jobs/cron` | `Authorization: Bearer $CRON_SECRET` or `x-cron-secret`; body `{ job, dryRun? }` |
| `POST /api/push/subscribe` | Session |
| `POST /api/push/unsubscribe` | Session |
| `POST /api/push/send` | `CRON_SECRET` or `system.manage` |
