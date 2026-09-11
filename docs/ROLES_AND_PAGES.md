# Roles and pages

Password for all demo users: `DEMO_PASSWORD`. Domain: `*@demo.beepabpo.com`.

Nav source of truth: `lib/app/navigation.ts`. Admin links are filtered by permission.

## Login → landing

| Role | Email | Login | Landing |
|------|-------|-------|---------|
| Owner | `owner@demo.beepabpo.com` | `/employee/login` | `/app/dashboard` (`system.manage`) |
| Super Admin | `superadmin@demo.beepabpo.com` | `/employee/login` | `/app/dashboard` |
| HR | `hr@demo.beepabpo.com` | `/employee/login` | `/app/my` |
| Recruiter | `recruiter@demo.beepabpo.com` | `/employee/login` | `/app/my` |
| Sales | `sales@demo.beepabpo.com` | `/employee/login` | `/app/crm` |
| Marketing | `marketing@demo.beepabpo.com` | `/employee/login` | `/app/cms` |
| Operations | `operations@demo.beepabpo.com` | `/employee/login` | `/app/my` |
| Team Lead | `teamlead@demo.beepabpo.com` | `/employee/login` | `/app/my` |
| Finance | `finance@demo.beepabpo.com` | `/employee/login` | `/app/my` |
| Employee | `employee@demo.beepabpo.com` | `/employee/login` | `/app/my` |
| Client Admin | `clientadmin@demo.beepabpo.com` | `/login` | `/app/client` |
| Client Viewer | `clientviewer@demo.beepabpo.com` | `/login` | `/app/client` |
| Applicant | `applicant@demo.beepabpo.com` | `/login` | `/app/applicant` |

## Primary nav trees

### Employee (`employeeNav`) — internal membership

Shown for all internal roles under **My Workspace**:

- `/app/my` Dashboard
- `/app/my/attendance`
- `/app/my/schedule`
- `/app/my/leave`
- `/app/my/payroll`
- `/app/my/nte`
- `/app/my/requests`
- `/app/my/documents`
- `/app/my/profile`
- `/app/my/support`

Also reachable (not always in sidebar): `/app/my/cash-advances`, `/app/my/notifications` (header bell).

### Client (`clientNav`)

- `/app/client` Dashboard
- `/app/client/team`
- `/app/client/attendance`
- `/app/client/timesheets`
- `/app/client/performance`
- `/app/client/requests`
- `/app/client/tickets` (+ `/app/client/tickets/[id]`)
- `/app/client/reports`
- `/app/client/documents`
- `/app/client/billing`
- `/app/client/settings`

Also exists: `/app/client/approvals` (in `clientNav` when `attendance.approve` + `approvals.act` + portal timesheet approval).

### Applicant (`applicantNav`)

- `/app/applicant` Applications
- `/app/applicant/profile`

## Admin nav groups (internal only)

Filtered by `getAdminNavGroups(permissions)`. Staff pages also call `requireInternal` (defense in depth). Cmd+K admin links require `isInternal`.

| Group | Item | Permission gate |
|-------|------|-----------------|
| HR | `/app/hr` | `employees.read` \| `employees.manage` \| `leave.read` |
| HR | `/app/hr/nte` | `nte.read` \| `nte.manage` |
| HR | `/app/attendance/corrections` | `attendance.approve` \| `correct` \| `manage` + internal |
| Payroll | `/app/payroll` | `payroll.read` \| `payroll.manage` |
| Recruitment | `/app/recruitment` | `recruitment.read` \| `recruitment.manage` |
| Marketing | `/app/cms` | `cms.manage` |
| CRM | `/app/crm`, leads, deals, proposals | `crm.read` \| `crm.manage` |
| Clients | `/app/clients` | `clients.read` \| `clients.manage` |
| Tickets | `/app/tickets` | `tickets.read` \| `tickets.manage` + internal |
| Tickets | `/app/tickets/sla` | `tickets.manage` **AND** `clients.manage` + internal |
| Billing | `/app/billing` | `billing.read` \| `billing.manage` + internal |
| Reports | `/app/reports` | `reports.read` \| `reports.export` + internal |
| Admin | `/app/approvals` | specific leave/attendance/… approve/manage codes (not bare `approvals.act`) |
| Admin | `/app/admin`, `/users`, `/organizations`, `/audit`, `/dashboard` | `system.manage` |

Hub children (employees, leave, periods, jobs, leads, …) inherit page-level `requirePermission` / `canAny`.

## What each role typically sees

| Role | Primary | Admin groups (seeded perms) |
|------|---------|-----------------------------|
| Owner | Employee nav + Dashboard landing | Nearly all admin groups |
| Super Admin | Employee nav + Dashboard | Admin (system) + Reports; self-* only otherwise |
| HR | Employee nav | HR, Approvals, Reports (+ cash advances via HR hub) |
| Recruiter | Employee nav | Recruitment (+ reports.read) |
| Sales | Employee nav | CRM (leads/deals/proposals) + Tickets + Clients (read) + Reports |
| Marketing | Employee nav | CMS + CRM + Tickets + Reports |
| Operations | Employee nav | Clients (**invite**), Tickets, Reports, Approvals |
| Team Lead | Employee nav | Approvals; leave/attendance approve via hub links |
| Finance | Employee nav | Payroll, Approvals, Reports |
| Employee | Employee nav | Approvals only (if acting on own queue items) |
| Client Admin | Client nav | None |
| Client Viewer | Client nav (read-leaning; billing may be empty under RLS) | None |
| Applicant | Applicant nav | None |

Exact matrix: [PERMISSIONS.md](./PERMISSIONS.md).

## Forbidden trees (segment layouts)

| Tree | Guard | Who is redirected |
|------|-------|-------------------|
| `/app/my/*` | `isInternal` | Clients, applicants → `/app` |
| `/app/client/*` | `isClient` | Internal-only, applicants → `/app` |
| `/app/applicant/*` | `isApplicantOnly` | Internal / client → `/app` |

Additional:

- Unauthenticated `/app/*` → proxy redirects to `/login?next=…`
- Missing permission on admin page → `forbidden()` (`app/app/forbidden.tsx`)
- No memberships → `/app/access-denied`
- Client on `/employee/login` → rejected with client/applicant message
