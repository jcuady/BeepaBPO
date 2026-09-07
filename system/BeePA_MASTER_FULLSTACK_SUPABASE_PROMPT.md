# BeePA BPO — Master Full-Stack Implementation Prompt
## Landing Page + PWA + CRM + HRIS + Attendance + Payroll + ATS + Client Portal + Ticketing

> **Use this file as the master implementation prompt for Cursor / Claude / Antigravity.**
>
> Act as a **Principal Full-Stack Engineer, Principal SaaS Architect, Principal UI/UX Engineer, Security Engineer, Database Architect, QA Lead, and DevOps Engineer**.
>
> Build the BeePA platform as a production-grade, multi-tenant BPO operating system under the same primary domain: **`beepabpo.com`**.
>
> Do not produce a toy demo, static prototype, disconnected pages, fake dashboards, placeholder workflows, or frontend-only mockups. Every implemented page must connect to real Supabase data, real permissions, real business rules, loading/error/empty states, validation, audit logging where required, and responsive behavior.

---

# 0. Existing Supabase Project

Use the existing hosted Supabase project.

```env
NEXT_PUBLIC_SUPABASE_URL=https://nwvnawgxkzwiercllgmg.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_0Xdn4IscjKFMrcllSY09FQ_YzWap2C9
```

Also create an `.env.example` containing:

```env
NEXT_PUBLIC_SUPABASE_URL=https://nwvnawgxkzwiercllgmg.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_0Xdn4IscjKFMrcllSY09FQ_YzWap2C9

# SERVER ONLY — obtain from Supabase Dashboard.
# NEVER expose this in client code and NEVER prefix it with NEXT_PUBLIC_.
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_SITE_URL=https://beepabpo.com

# Web Push / PWA
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@beepabpo.com

# Optional transactional email provider
RESEND_API_KEY=
EMAIL_FROM=BeePA <no-reply@beepabpo.com>

# Optional Sentry / monitoring
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
```

## Security rule

The supplied `sb_publishable_...` key is a **publishable client key**. It may be used in the browser only because **Row Level Security must protect every table**.

Never:

- use a Supabase service-role key in client-side code;
- disable RLS for convenience;
- trust a role supplied from the browser;
- allow public users to self-assign privileged roles;
- store passwords manually;
- bypass Supabase Auth with a custom plaintext authentication table.

---

# 1. Product Vision

BeePA is one unified BPO business platform for:

```text
Marketing
→ Lead Generation
→ CRM
→ Sales
→ Client Onboarding
→ Recruitment / ATS
→ Employee Onboarding
→ Workforce Assignment
→ Attendance / Timesheets
→ Leave / PTO / UPTO
→ HR
→ NTE / Employee Relations
→ Cash Advances
→ Payroll / Commissions
→ Client Portal
→ Ticketing / Requests
→ Performance
→ Client Billing
→ Reporting
→ Executive Analytics
```

The system must scale from BeePA's current organization to **100+ employees, multiple clients, multiple time zones, and different client attendance rules** without rebuilding workflows for each new client.

---

# 2. Non-Negotiable Architecture Rules

## 2.1 One identity, multiple roles

Internal administrative users are still employees.

Example:

```text
Maria
├── Employee
└── HR Manager
```

Maria must use the same account for:

### Personal employee functions

- Attendance
- Schedule
- Leave
- PTO / UPTO
- Cash advances
- Payroll
- Payslips
- Personal documents
- NTE responses
- Notifications

### HR functions

- Employee management
- Leave approval
- Attendance administration
- NTE
- Performance
- HR reporting

Do not create separate HR and employee accounts for the same person.

---

## 2.2 Multi-tenant client isolation

A client company is an organization/tenant.

```text
CloudPeak
├── Client Admin
├── Client Manager
└── Client Viewer
```

CloudPeak users must never see:

- another client's employees;
- another client's attendance;
- another client's tickets;
- another client's billing;
- internal BeePA payroll;
- private HR records.

Enforce this at the **database/RLS layer**, not merely by hiding UI elements.

---

## 2.3 Same domain

Use the same domain and route groups:

```text
beepabpo.com/                     Public marketing website
beepabpo.com/careers              Careers
beepabpo.com/sign-in              General sign-in
beepabpo.com/sign-up              Public account creation where permitted
beepabpo.com/employee-sign-in     Internal employee/admin sign-in
beepabpo.com/client-sign-in       Client sign-in
beepabpo.com/app                  Authenticated platform
beepabpo.com/api                  Server route handlers where needed
```

Do not use a separate `app.beepabpo.com` deployment.

---

# 3. Existing Project Assets

Before coding, inspect and reuse the existing project directories.

Expected source material includes:

```text
Assets/
├── Heroimage.png
├── logo.png
├── logo2.png
└── section image.png

Branding/
├── 01_MASTER_BRANDBOOK.md
├── 11_AI_IMPLEMENTATION_RULES.md
└── BeePA_COMPLETE_BRANDBOOK.md

Mockup/
└── Mockup.png
```

Rules:

1. Treat the brandbook files as the source of truth.
2. Do not replace the existing logo with an invented logo.
3. Reuse the supplied ultra-HD marketing assets where appropriate.
4. Optimize images for production instead of serving unnecessarily huge files.
5. Preserve visual consistency across public website, careers, auth, PWA, and all dashboards.

---

# 4. Brand Design System

## Core colors

```css
--beepa-navy: #1F2058;
--beepa-green: #119446;
--beepa-lime: #93C63D;
--beepa-white: #FFFFFF;

--beepa-ink: #17182B;
--beepa-slate: #667085;
--beepa-border: #EAECF0;
--beepa-mist: #F5F7F6;
--beepa-soft-green: #EEF7E8;
```

Approximate public-brand balance:

```text
60% White / light neutral
25% Navy
10% Green
5% Lime
```

## Typography

```text
Display / headings: Manrope
Body / product UI: Inter
```

## Brand language

Primary:

> People. Partnership. Progress.

Story:

> Built on Purpose. Growing Together.

Marketing:

> Better Teams. Stronger Businesses.

## Product UI style

Create a custom BeePA design system over component primitives.

Do not deliver default shadcn styling.

Product UI must be:

- modern;
- professional;
- human;
- clean;
- highly readable;
- data-focused;
- accessible;
- restrained;
- consistent.

Avoid:

- random gradients;
- purple AI aesthetics;
- excessive glassmorphism;
- neon;
- 3D icon packs;
- cartoon SaaS visuals;
- excessive rounded pills;
- decorative charts;
- different visual systems per role.

---

# 5. Recommended Technical Stack

Use the current stable project-compatible versions of:

## Frontend

- Next.js App Router
- TypeScript with `strict: true`
- React
- Tailwind CSS
- shadcn/ui as primitives, fully BeePA-customized
- React Hook Form
- Zod
- TanStack Table for complex tables
- Recharts for charts
- GSAP / ScrollTrigger only for high-value public marketing animation
- CSS transitions for product microinteractions

## Backend / Platform

- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- Supabase Realtime where appropriate
- Supabase Edge Functions for privileged async workflows where appropriate
- PostgreSQL functions/triggers for sensitive derived operations

## PWA

Use a modern service-worker integration such as **Serwist** or an equivalent production-maintained PWA solution.

Support:

- installability;
- iOS home-screen installation;
- Android installation;
- desktop installation;
- push notifications;
- safe-area handling;
- update notification;
- offline-aware UI.

## Quality

- ESLint
- Prettier
- Vitest
- React Testing Library
- Playwright
- axe accessibility checks

---

# 6. Suggested Project Structure

```text
src/
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx
│   │   ├── about/
│   │   ├── services/
│   │   ├── industries/
│   │   ├── how-it-works/
│   │   ├── case-studies/
│   │   ├── resources/
│   │   ├── careers/
│   │   ├── contact/
│   │   └── book-consultation/
│   │
│   ├── (auth)/
│   │   ├── sign-in/
│   │   ├── sign-up/
│   │   ├── employee-sign-in/
│   │   ├── client-sign-in/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   └── auth/callback/
│   │
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── dashboard/
│   │   ├── my/
│   │   ├── employees/
│   │   ├── clients/
│   │   ├── attendance/
│   │   ├── schedules/
│   │   ├── leave/
│   │   ├── hr/
│   │   ├── nte/
│   │   ├── cash-advances/
│   │   ├── payroll/
│   │   ├── commissions/
│   │   ├── recruitment/
│   │   ├── crm/
│   │   ├── marketing/
│   │   ├── performance/
│   │   ├── tickets/
│   │   ├── requests/
│   │   ├── billing/
│   │   ├── documents/
│   │   ├── reports/
│   │   ├── notifications/
│   │   ├── approvals/
│   │   ├── audit/
│   │   └── settings/
│   │
│   └── api/
│
├── components/
│   ├── brand/
│   ├── layout/
│   ├── marketing/
│   ├── auth/
│   ├── employee/
│   ├── attendance/
│   ├── payroll/
│   ├── hr/
│   ├── crm/
│   ├── recruitment/
│   ├── clients/
│   ├── tickets/
│   ├── reports/
│   └── ui/
│
├── features/
├── hooks/
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   ├── middleware.ts
│   │   └── admin.ts
│   ├── auth/
│   ├── permissions/
│   ├── payroll/
│   ├── attendance/
│   ├── notifications/
│   └── validation/
│
├── types/
└── styles/

supabase/
├── migrations/
├── functions/
├── seed.sql
└── config.toml

scripts/
├── seed-demo-users.ts
├── create-owner.ts
└── generate-db-types.ts
```

---

# 7. Authentication and Account Model

Use **Supabase Auth** as the only credential authority.

## 7.1 Supported login

Primary:

- Email + password

Support:

- forgot password;
- reset password;
- remember session securely;
- email verification;
- logout current session;
- logout all sessions.

Optional when configured:

- Google OAuth
- Microsoft OAuth
- passwordless magic link

Do not block implementation if OAuth keys are not available. Build provider buttons only when configured or clearly mark them unavailable.

---

## 7.2 Login routing

After successful authentication:

1. Load `profile`.
2. Load active organization memberships.
3. Load roles/permissions.
4. If one workspace: route directly.
5. If multiple workspaces: show workspace selector.
6. Render role-aware dashboard.
7. Keep employee self-service available to internal staff regardless of admin role.

---

## 7.3 Public sign-up

Public signup must never allow selecting:

- Owner
- Super Admin
- HR
- Finance
- Recruiter
- Sales
- Marketing
- Operations
- Team Leader
- Client Admin

Privileged users are created by invitation or admin assignment.

Public signup may be used for:

- applicant accounts;
- prospective client inquiry accounts if BeePA wants this;
- invited client users completing account setup.

---

## 7.4 Internal employee onboarding

```text
HR/Admin creates employee
→ system creates pending user invitation
→ employee receives secure invite
→ employee completes account
→ profile is linked to employee record
→ permissions are inherited from assigned roles
```

---

## 7.5 Client onboarding

```text
BeePA creates client organization
→ BeePA creates Client Admin invitation
→ Client Admin activates account
→ Client Admin may invite additional client users if allowed
→ all client users inherit tenant-scoped policies
```

---

# 8. Roles

Create these standard roles.

## Internal

1. Owner / CEO
2. Super Admin
3. HR
4. Recruiter / Talent Acquisition
5. Sales / SDR
6. Marketing
7. Operations Manager
8. Account Manager
9. Team Leader
10. Finance / Payroll
11. Employee / Agent / VA

## External

12. Client Admin
13. Client Viewer / Client Manager
14. Applicant

Roles are **not mutually exclusive**.

A user can have:

```text
Employee + HR
Employee + Team Leader
Employee + Finance
Employee + Operations Manager
```

---

# 9. Permissions

Do not scatter role checks throughout UI code.

Create centralized permission identifiers.

Suggested examples:

```text
system.manage
system.audit.read
system.settings.manage
users.manage
roles.manage
permissions.manage

employees.read
employees.manage
employees.documents.read
employees.documents.manage

attendance.self
attendance.read
attendance.manage
attendance.approve
attendance.correct

leave.self
leave.read
leave.manage
leave.approve

nte.self
nte.read
nte.manage

cash_advance.self
cash_advance.read
cash_advance.manage
cash_advance.approve

payroll.self
payroll.read
payroll.manage
payroll.approve

crm.read
crm.manage
crm.reports

recruitment.read
recruitment.manage

clients.read
clients.manage
clients.employee_visibility

tickets.self
tickets.read
tickets.manage

billing.read
billing.manage

performance.self
performance.read
performance.manage

reports.read
reports.export
```

Create reusable functions:

```ts
can(permission)
canAny([...permissions])
canAll([...permissions])
```

And database equivalents:

```sql
has_permission(...)
is_internal_user(...)
is_client_member(...)
can_access_client(...)
is_self(...)
```

---

# 10. Database Design Principles

1. UUID primary keys.
2. `created_at` / `updated_at` on business tables.
3. Soft-delete only where business retention requires it.
4. Use explicit status enums/check constraints.
5. Monetary values use `numeric`, never float.
6. Store timestamps in UTC.
7. Store the relevant IANA timezone (`America/New_York`, `Asia/Manila`, etc.).
8. Do not calculate official attendance from browser time.
9. Use server/database timestamps for authoritative events.
10. Add indexes for organization IDs, employee IDs, client IDs, dates, status, and foreign keys.
11. Add RLS to every user-accessible table.
12. Use database constraints to prevent impossible states.
13. Audit sensitive state changes.

---

# 11. Core Database Schema

Use the following as the required baseline. Normalize sensibly where implementation requires it.

---

## 11.1 Identity / Organizations / Roles

### `profiles`

```text
id uuid PK FK auth.users.id
first_name text
middle_name text nullable
last_name text
display_name text
avatar_url text nullable
phone text nullable
timezone text default 'Asia/Manila'
locale text default 'en-PH'
status text
last_login_at timestamptz nullable
created_at
updated_at
```

### `organizations`

Represents BeePA itself and client companies.

```text
id uuid PK
type enum: internal | client
name text
slug text unique
legal_name text nullable
country text nullable
timezone text
status enum: active | inactive | onboarding
logo_url text nullable
created_at
updated_at
```

Seed internal organization:

```text
BeePA BPO
type = internal
```

### `organization_memberships`

```text
id uuid PK
organization_id uuid FK
user_id uuid FK profiles
membership_type enum: internal | client
status enum: invited | active | suspended | inactive
is_primary boolean
created_at
updated_at
unique (organization_id, user_id)
```

### `roles`

```text
id uuid PK
code text unique
name text
scope enum: system | internal | client | applicant
description text
is_system boolean
```

### `permissions`

```text
id uuid PK
code text unique
description text
```

### `role_permissions`

```text
role_id uuid
permission_id uuid
PK(role_id, permission_id)
```

### `membership_roles`

```text
membership_id uuid
role_id uuid
PK(membership_id, role_id)
```

---

# 12. Employee / Workforce Schema

### `employees`

```text
id uuid PK
organization_id uuid FK   # normally BeePA internal org
profile_id uuid nullable FK profiles
employee_number text unique
work_email text
personal_email text nullable
employment_status enum
employment_type enum
job_title text
department_id uuid nullable
team_id uuid nullable
manager_employee_id uuid nullable
hire_date date
regularization_date date nullable
termination_date date nullable
default_timezone text
payroll_profile_id uuid nullable
created_at
updated_at
```

### `departments`

```text
id
organization_id
name
code
manager_employee_id nullable
status
```

### `teams`

```text
id
organization_id
department_id nullable
name
team_lead_employee_id nullable
```

### `employee_assignments`

Supports internal and client assignments.

```text
id uuid PK
employee_id uuid
client_organization_id uuid nullable
assignment_type enum: internal | client
role_title text
start_date date
end_date date nullable
status enum
attendance_policy_id uuid
schedule_template_id uuid nullable
account_manager_employee_id uuid nullable
billable boolean
created_at
updated_at
```

---

# 13. Client Management Schema

### `client_profiles`

```text
organization_id uuid PK FK organizations
industry text nullable
website text nullable
primary_contact_name text nullable
primary_contact_email text nullable
relationship_start_date date nullable
contract_start_date date nullable
contract_end_date date nullable
account_manager_employee_id uuid nullable
billing_currency text default 'USD'
notes text nullable
```

### `client_contacts`

```text
id
client_organization_id
name
email
phone
job_title
is_primary
```

### `client_settings`

```text
client_organization_id
allow_attendance_view boolean
allow_timesheet_approval boolean
allow_performance_view boolean
allow_billing_view boolean
allow_documents_view boolean
allow_ticketing boolean
```

---

# 14. Attendance and Scheduling

Attendance must support different rules per client.

### `attendance_policies`

```text
id
organization_id
client_organization_id nullable
name
timezone
schedule_type enum: fixed | flexible
grace_minutes integer
required_minutes_per_day integer nullable
required_minutes_per_week integer nullable
break_minutes integer
auto_deduct_break boolean
overtime_enabled boolean
overtime_requires_approval boolean
client_timesheet_approval_required boolean
active boolean
```

### `schedule_templates`

```text
id
organization_id
name
timezone
monday_start time nullable
monday_end time nullable
...
sunday_start time nullable
sunday_end time nullable
```

Prefer a normalized `schedule_template_days` child table if cleaner.

### `shift_assignments`

```text
id
employee_id
assignment_id
work_date date
scheduled_start timestamptz
scheduled_end timestamptz
status
source enum: template | override | manual
```

### `attendance_events`

Immutable raw event log.

```text
id
employee_id
shift_assignment_id nullable
event_type enum: clock_in | break_start | break_end | clock_out
server_recorded_at timestamptz
client_reported_at timestamptz nullable
latitude numeric nullable
longitude numeric nullable
accuracy_meters numeric nullable
ip_address inet nullable
device_id text nullable
source enum: pwa | web | admin
created_by uuid
```

### `attendance_records`

Derived daily summary.

```text
id
employee_id
work_date date
shift_assignment_id nullable
clock_in_at timestamptz nullable
clock_out_at timestamptz nullable
worked_minutes integer
break_minutes integer
late_minutes integer
undertime_minutes integer
overtime_minutes integer
status enum: present | late | absent | leave | rest_day | holiday | incomplete
approval_status enum: draft | employee_review | supervisor_review | client_review | finalized
```

### `attendance_correction_requests`

```text
id
attendance_record_id
employee_id
requested_clock_in_at nullable
requested_clock_out_at nullable
reason
attachment_url nullable
status
reviewed_by nullable
review_notes nullable
```

### `overtime_requests`

```text
id
employee_id
work_date
requested_minutes
reason
status
approved_by nullable
```

### `holiday_calendars`

### `holidays`

Support BeePA and client-specific calendars.

---

# 15. Leave / PTO / UPTO

### `leave_types`

```text
id
organization_id
code
name
paid boolean
unit enum: hours | days
requires_attachment boolean
active boolean
```

Seed examples:

- PTO
- UPTO
- Sick Leave
- Vacation Leave
- Emergency Leave
- Bereavement Leave

### `leave_balances`

```text
id
employee_id
leave_type_id
period_year integer
entitled_minutes integer
used_minutes integer
pending_minutes integer
adjustment_minutes integer
```

### `leave_requests`

```text
id
employee_id
leave_type_id
start_at
end_at
requested_minutes
reason
attachment_url nullable
status enum: pending | manager_approved | hr_approved | approved | rejected | cancelled
current_approver nullable
created_at
updated_at
```

Approved leave must synchronize with attendance and payroll rules.

---

# 16. Cash Advances

### `cash_advance_requests`

```text
id
employee_id
requested_amount numeric
approved_amount numeric nullable
reason
requested_repayment_periods integer nullable
status
hr_reviewed_by nullable
finance_reviewed_by nullable
approved_by nullable
released_at nullable
remaining_balance numeric
```

### `cash_advance_deductions`

```text
id
cash_advance_id
payroll_record_id
amount
deducted_at
```

---

# 17. NTE / Employee Relations

### `nte_cases`

```text
id
employee_id
case_number
incident_date
incident_type
subject
description
evidence_urls jsonb
issued_by
issued_at
response_due_at
status enum:
  draft
  issued
  awaiting_response
  under_review
  resolved
resolution_type nullable
resolution_notes nullable
resolved_by nullable
resolved_at nullable
```

### `nte_responses`

```text
id
nte_case_id
employee_id
response_text
attachment_urls jsonb
submitted_at
```

### `disciplinary_actions`

```text
id
nte_case_id
action_type
effective_date
notes
created_by
```

Employees can only access their own cases/responses.

---

# 18. Payroll

No tax computation is required unless explicitly added later.

### `payroll_profiles`

```text
id
employee_id unique
pay_frequency enum: semi_monthly | monthly | weekly | hourly
compensation_type enum: monthly_salary | hourly | daily
base_salary numeric nullable
hourly_rate numeric nullable
daily_rate numeric nullable
currency text default 'PHP'
overtime_multiplier numeric default 1
active boolean
```

### `payroll_periods`

```text
id
organization_id
name
start_date
end_date
pay_date
status enum: draft | preparing | review | approval | finalized | disbursed | closed
created_by
approved_by nullable
finalized_at nullable
```

### `payroll_records`

One row per employee per payroll period.

```text
id
payroll_period_id
employee_id
basic_pay numeric
worked_minutes integer
overtime_minutes integer
overtime_pay numeric
undertime_minutes integer
undertime_deduction numeric
absence_deduction numeric
paid_leave_amount numeric
unpaid_leave_deduction numeric
allowances numeric
bonuses numeric
incentives numeric
commissions numeric
cash_advance_deduction numeric
other_deductions numeric
manual_adjustments numeric
gross_pay numeric
total_deductions numeric
net_pay numeric
status
calculation_snapshot jsonb
```

### `payroll_components`

Use for detailed line items.

```text
id
payroll_record_id
type enum: earning | deduction | adjustment
code
label
quantity numeric nullable
rate numeric nullable
amount numeric
source_type nullable
source_id nullable
```

### `payslips`

```text
id
payroll_record_id unique
employee_id
generated_at
pdf_path nullable
version integer
```

### Payroll rules

1. Finalized attendance feeds payroll.
2. Approved paid/unpaid leave feeds payroll.
3. Approved overtime feeds payroll.
4. Commissions feed payroll.
5. Cash advance deductions feed payroll.
6. Manual changes require reason and audit log.
7. Finalized payroll cannot be silently edited.
8. Reopening requires elevated permission and audit entry.
9. Clients never see employee compensation.

---

# 19. Commissions

### `commission_periods`

```text
id
name
start_date
end_date
status
```

### `commission_records`

```text
id
commission_period_id
employee_id
basis_description
base_amount nullable
commission_rate nullable
calculated_amount
adjustment_amount
final_amount
status enum: draft | review | approved | included_in_payroll
approved_by nullable
payroll_record_id nullable
```

---

# 20. Client Billing / Invoicing

Keep separate from employee payroll.

### `billing_accounts`

```text
client_organization_id
currency
payment_terms_days
billing_email
status
```

### `invoices`

```text
id
client_organization_id
invoice_number
period_start
period_end
issue_date
due_date
subtotal
adjustments
total
currency
status enum: draft | issued | sent | partially_paid | paid | overdue | void
```

### `invoice_items`

```text
id
invoice_id
employee_assignment_id nullable
description
quantity
unit_rate
amount
```

### `invoice_payments`

```text
id
invoice_id
amount
paid_at
reference
method nullable
```

Do not expose payroll salary through billing APIs.

---

# 21. CRM / Sales

### `crm_leads`

```text
id
company_name
contact_name
contact_email
contact_phone
country
industry
source
status
assigned_sales_user_id
notes
created_at
updated_at
```

Supported sources:

- Google Organic
- Website
- Facebook
- LinkedIn
- WhatsApp
- Email
- Referral
- Indeed
- JobStreet
- Manual
- Other

### `crm_contacts`

### `crm_companies`

Prospect/company records separate from active client organizations until won.

### `crm_deals`

```text
id
lead_id nullable
company_id
title
stage enum:
  new_lead
  contacted
  qualified
  discovery
  proposal
  negotiation
  won
  lost
  on_hold
  follow_up_later
estimated_value numeric nullable
currency
expected_close_date nullable
lost_reason nullable
owner_user_id
```

### `crm_activities`

- call
- email
- meeting
- note
- task
- follow-up

### `crm_proposals`

### `crm_contracts`

When a deal becomes `won`, provide a controlled workflow:

```text
Won Deal
→ Create Client Organization
→ Create Client Profile
→ Create Client Admin Invite
→ Start Client Onboarding Checklist
```

---

# 22. Careers / ATS / Recruitment

Public routes:

```text
/careers
/careers/[job-slug]
/careers/[job-slug]/apply
```

### `job_posts`

```text
id
title
slug
department_id nullable
employment_type
location_type enum: remote | onsite | hybrid
location_text
description
responsibilities
requirements
nice_to_have
salary_display nullable
status enum: draft | published | closed
published_at nullable
created_by
```

### `applicants`

```text
id
profile_id nullable
first_name
last_name
email
phone
location
resume_path
linkedin_url nullable
portfolio_url nullable
source
created_at
```

### `job_applications`

```text
id
applicant_id
job_post_id
stage enum:
  applied
  screening
  initial_interview
  assessment
  client_endorsement
  client_interview
  offer
  hired
  rejected
  withdrawn
  talent_pool
  on_hold
assigned_recruiter_user_id nullable
salary_expectation nullable
availability_date nullable
notes nullable
```

### `application_stage_history`

### `interviews`

### `assessments`

### `applicant_documents`

### Hire conversion

Implement:

```text
Convert to Employee
```

This must:

1. create employee record;
2. preserve applicant history;
3. link profile/user if available;
4. create employee number;
5. create onboarding checklist;
6. invite employee to internal platform if account not active.

Never force HR to re-enter the same data.

---

# 23. Performance

### `performance_cycles`

### `performance_reviews`

```text
id
employee_id
cycle_id
reviewer_user_id
reviewer_type enum: self | manager | client | hr
visibility enum: internal | employee_visible | client_visible
overall_score nullable
comments
status
```

### `performance_goals`

### `performance_kpis`

### `performance_improvement_plans`

Only approved `client_visible` performance data can be shown in client portal.

---

# 24. Ticketing

### `tickets`

```text
id
ticket_number
client_organization_id nullable
requester_user_id
employee_id nullable
category enum:
  employee_concern
  attendance
  schedule_change
  performance
  replacement_request
  additional_employee
  payroll
  billing
  hr
  technical
  implementation
  general
priority enum: low | normal | high | urgent
status enum:
  new
  assigned
  in_progress
  waiting_for_client
  resolved
  closed
assigned_team nullable
assigned_user_id nullable
subject
description
first_response_at nullable
resolved_at nullable
sla_due_at nullable
created_at
updated_at
```

### `ticket_messages`

Client-visible conversation.

### `ticket_internal_notes`

Never visible to clients.

### `ticket_attachments`

### `ticket_status_history`

### `ticket_sla_policies`

### Implementation requests

Use the ticket engine with `category = implementation`, or create a dedicated child table if more workflow data is required.

---

# 25. Documents

Use Supabase Storage with private buckets.

Buckets:

```text
avatars
employee-documents
applicant-documents
ticket-attachments
client-documents
contracts
payslips
marketing-media
```

### `documents`

```text
id
organization_id
employee_id nullable
client_organization_id nullable
category
title
storage_bucket
storage_path
mime_type
size_bytes
visibility
uploaded_by
created_at
expires_at nullable
```

Use signed URLs for private content.

Never make HR/payroll documents public.

---

# 26. Notifications

### `notifications`

```text
id
user_id
type
title
body
action_url nullable
entity_type nullable
entity_id nullable
read_at nullable
created_at
```

### `push_subscriptions`

```text
id
user_id
endpoint
p256dh
auth
user_agent
device_label nullable
created_at
last_used_at
```

Support:

- in-app notifications;
- Web Push;
- email where configured.

Notification examples:

## Employee

- shift reminder;
- missing clock-in;
- missing clock-out;
- leave approved/rejected;
- attendance correction decision;
- cash advance decision;
- new payslip;
- payroll finalized;
- NTE issued;
- announcement.

## HR

- leave request;
- attendance correction;
- cash advance request;
- NTE response;
- expiring document.

## Finance

- payroll review;
- payroll approval;
- commission cutoff;
- approved cash advance;
- overdue invoice.

## Sales

- new website lead;
- follow-up due;
- meeting reminder;
- stale opportunity.

## Recruitment

- new applicant;
- interview reminder;
- assessment complete;
- candidate awaiting review.

## Client

- timesheet approval;
- ticket update;
- ticket resolution;
- request update;
- report available.

---

# 27. Audit Logs

### `audit_logs`

```text
id
actor_user_id nullable
organization_id nullable
action
entity_type
entity_id
before_data jsonb nullable
after_data jsonb nullable
ip_address inet nullable
user_agent text nullable
created_at
```

Audit at minimum:

- user/role changes;
- permissions;
- employee updates;
- attendance corrections;
- finalized timesheet changes;
- leave approval/rejection;
- NTE creation/resolution;
- cash advance approval;
- payroll changes;
- payroll finalization/reopening;
- commission adjustments;
- client assignment changes;
- ticket admin actions;
- invoice changes;
- system configuration.

Audit records must be append-only to normal users.

---

# 28. CMS / Website Content

Create manageable content models for:

### `services`

### `industries`

### `testimonials`

### `case_studies`

### `blog_posts`

### `faqs`

### `site_pages`

### `site_settings`

Marketing role can manage approved CMS data but cannot access HR/payroll records.

---

# 29. Row Level Security

RLS is mandatory.

Create SQL helper functions using `SECURITY DEFINER` only when necessary, with a fixed `search_path`.

Required policy logic:

## Employee

Can access own:

- profile;
- attendance;
- schedules;
- leave;
- payroll/payslips;
- cash advances;
- NTE;
- performance marked employee-visible;
- personal documents;
- notifications.

Cannot access another employee merely by changing an ID.

## HR

Can access BeePA employee HR data according to permission.

Payroll compensation should require payroll permission even if user is HR, unless BeePA explicitly grants HR payroll access.

## Finance

Can manage payroll, commissions, billing, approved cash advances.

Does not automatically receive full HR disciplinary access.

## Sales

CRM only, plus own employee self-service.

## Marketing

CMS/analytics only, plus own employee self-service.

## Recruiter

ATS/job/applicant data, plus own employee self-service.

## Team Leader

Assigned team only for attendance, schedules, approvals, performance, unless additional permissions exist.

## Client Admin

Can access only:

- own client organization;
- assigned employees;
- client-visible employee fields;
- approved attendance;
- timesheets;
- client-visible performance;
- own tickets;
- client documents;
- own billing when enabled.

## Client Viewer

Read-only subset.

## Applicant

Own application/profile only.

## Owner

Business-wide internal oversight.

## Super Admin

System-level administration.

Create automated tests proving cross-tenant data cannot leak.

---

# 30. Approval Engine

Do not implement custom approval logic independently for every module.

Create reusable tables:

### `approval_workflows`

### `approval_steps`

### `approval_requests`

### `approval_actions`

Support:

```text
Leave:
Employee → Team Lead → HR

Attendance Correction:
Employee → Supervisor/HR

Cash Advance:
Employee → HR → Finance

Payroll:
Finance → Owner/Authorized Approver

Timesheet:
Employee → BeePA Supervisor → Client (optional)
```

Workflow configuration should allow client-specific approval rules.

---

# 31. Public Website Pages

Build all pages fully responsive and SEO-ready.

## `/`

Homepage:

1. Header
2. Hero
3. Trusted companies / proof
4. Services
5. Why BeePA
6. BeePA client platform differentiator
7. How it works
8. Industries
9. Testimonials
10. Story
11. Careers
12. Resources
13. FAQ
14. Final CTA
15. Footer

Primary CTA:

> Build Your Team

Secondary:

> Book a Consultation

## `/about`

- founder story;
- 2019 origin;
- legacy;
- mission;
- vision;
- values;
- timeline;
- leadership;
- culture.

## `/services`

Overview.

## `/services/[slug]`

SEO service pages.

## `/industries`

Overview.

## `/industries/[slug]`

Industry-specific SEO pages.

## `/how-it-works`

```text
Discovery
→ Requirements
→ Talent Sourcing
→ Client Interview
→ Hiring
→ Onboarding
→ Operations
→ Continuous Support
```

## `/case-studies`

## `/case-studies/[slug]`

## `/resources`

## `/resources/[slug]`

## `/careers`

## `/careers/[slug]`

## `/contact`

## `/book-consultation`

Forms create CRM leads with attribution.

---

# 32. SEO

Implement:

- metadata;
- canonical URLs;
- robots;
- sitemap;
- OG images;
- semantic HTML;
- schema.org structured data where appropriate;
- optimized images;
- internal linking;
- proper heading hierarchy;
- Core Web Vitals;
- Google Search Console readiness;
- analytics hooks.

Persist lead attribution:

```text
utm_source
utm_medium
utm_campaign
utm_term
utm_content
referrer
landing_page
first_touch_at
```

CRM must retain original source.

---

# 33. Auth Pages

## `/sign-in`

General sign-in.

## `/sign-up`

Only safe public signup.

## `/employee-sign-in`

BeePA employee/internal portal entry.

## `/client-sign-in`

Client portal entry.

## `/forgot-password`

## `/reset-password`

All auth screens must:

- reuse BeePA logo;
- match supplied mockups;
- be responsive;
- provide proper errors;
- prevent enumeration where practical;
- have accessible labels;
- support iPhone safe areas;
- work with password managers.

---

# 34. App Shell

## Desktop

- BeePA logo;
- collapsible sidebar;
- global search/command menu;
- notification center;
- user/workspace switcher;
- breadcrumb;
- role-aware navigation;
- consistent data tables/cards.

## Mobile PWA

Use bottom navigation with **maximum five primary destinations**.

Employee recommendation:

```text
Home
Schedule
Payroll
Requests
More
```

Attendance/Clock In remains highly prominent on Home.

Admin users get adaptive navigation, not a shrunk desktop sidebar.

---

# 35. Owner / CEO Pages

Routes:

```text
/app/dashboard
/app/executive/workforce
/app/executive/clients
/app/executive/sales
/app/executive/recruitment
/app/executive/hr
/app/executive/payroll
/app/executive/support
/app/reports
/app/approvals
```

Dashboard:

- total employees;
- active clients;
- attendance;
- leave;
- new leads;
- active deals;
- applicants;
- hires;
- payroll status;
- payroll amount;
- commissions;
- outstanding invoices;
- open tickets;
- pending approvals;
- trends.

Do not overload with meaningless charts.

---

# 36. Super Admin Pages

```text
/app/admin
/app/admin/organizations
/app/admin/users
/app/admin/roles
/app/admin/permissions
/app/admin/access-control
/app/admin/integrations
/app/admin/audit
/app/admin/system-health
/app/admin/configurations
/app/admin/notifications
/app/admin/backups
/app/admin/settings
```

Functions:

- invite user;
- suspend user;
- revoke session;
- assign memberships;
- assign roles;
- manage permissions;
- manage integrations;
- view audit trail;
- view system health;
- configuration values;
- notification templates.

Super Admin is system-focused, not business-operation focused.

---

# 37. Employee Portal

Every internal BeePA user gets employee self-service.

Routes:

```text
/app/my
/app/my/attendance
/app/my/schedule
/app/my/leave
/app/my/payroll
/app/my/payslips
/app/my/cash-advances
/app/my/requests
/app/my/nte
/app/my/documents
/app/my/performance
/app/my/profile
/app/my/notifications
```

Employee home:

- today's shift;
- clock in/out;
- current attendance status;
- hours today;
- days present this week;
- leave balances;
- next payroll;
- announcements;
- quick actions;
- upcoming schedule;
- tasks/approvals.

---

# 38. HR Pages

```text
/app/hr
/app/employees
/app/employees/[id]
/app/attendance
/app/attendance/logs
/app/attendance/team
/app/attendance/policies
/app/schedules
/app/leave
/app/leave/balances
/app/nte
/app/cash-advances
/app/performance
/app/documents
/app/hr/reports
```

HR dashboard:

- employees;
- active/new hires;
- present/late/absent;
- on leave;
- pending leave;
- PTO/UPTO;
- cash advances;
- NTE;
- expiring documents;
- probation/regularization milestones.

---

# 39. Attendance HR UX

Attendance admin page must include:

- date selector;
- present;
- late;
- absent;
- on leave;
- WFH where enabled;
- overtime;
- undertime;
- incomplete records;
- daily trend;
- team breakdown;
- client filter;
- department filter;
- employee table;
- correction queue;
- export.

Employee clock widget:

- server-confirmed clock-in;
- server-confirmed clock-out;
- break controls;
- location if enabled;
- connection state;
- success confirmation.

Offline behavior:

- do not falsify official attendance;
- show offline state;
- preserve user intent locally if useful;
- official time remains server timestamp when request succeeds;
- clearly disclose delayed sync.

---

# 40. Payroll / Finance Pages

```text
/app/payroll
/app/payroll/periods
/app/payroll/periods/[id]
/app/payroll/employees/[employeeId]
/app/payroll/adjustments
/app/payroll/commissions
/app/payroll/cash-advances
/app/payroll/payslips
/app/payroll/audit
/app/billing
/app/billing/invoices
/app/billing/invoices/[id]
```

Payroll dashboard:

- current period;
- total employees;
- processed;
- pending;
- gross payroll;
- total deductions;
- net payroll;
- payroll trend;
- breakdown;
- recent activity;
- review queue.

Payroll processing flow:

```text
Prepare
→ Validate Attendance
→ Calculate
→ Review Exceptions
→ Apply Adjustments
→ Approval
→ Finalize
→ Generate Payslips
→ Mark Disbursed
→ Close
```

Add a discrepancy panel:

- missing attendance;
- incomplete shift;
- unresolved correction;
- missing rate;
- negative net pay;
- unusual overtime;
- duplicate component.

---

# 41. Recruitment / ATS Pages

```text
/app/recruitment
/app/recruitment/jobs
/app/recruitment/jobs/new
/app/recruitment/jobs/[id]
/app/recruitment/applicants
/app/recruitment/applicants/[id]
/app/recruitment/pipeline
/app/recruitment/interviews
/app/recruitment/assessments
/app/recruitment/talent-pool
/app/recruitment/reports
```

Functions:

- create job;
- publish/close job;
- candidate filters;
- move stage;
- schedule interview;
- record notes;
- upload assessment;
- endorse to client;
- record offer;
- convert to employee.

---

# 42. Sales / CRM Pages

```text
/app/crm
/app/crm/leads
/app/crm/leads/[id]
/app/crm/companies
/app/crm/contacts
/app/crm/deals
/app/crm/deals/[id]
/app/crm/tasks
/app/crm/activities
/app/crm/proposals
/app/crm/contracts
/app/crm/reports
```

Dashboard:

- new leads;
- follow-ups;
- meetings;
- pipeline;
- proposal stage;
- won/lost;
- conversion;
- lead source.

---

# 43. Marketing Pages

```text
/app/marketing
/app/marketing/pages
/app/marketing/services
/app/marketing/industries
/app/marketing/blog
/app/marketing/testimonials
/app/marketing/case-studies
/app/marketing/careers-content
/app/marketing/seo
/app/marketing/analytics
```

Marketing cannot access payroll or disciplinary data.

---

# 44. Operations / Account Manager Pages

```text
/app/operations
/app/clients
/app/clients/[id]
/app/clients/[id]/team
/app/clients/[id]/attendance
/app/clients/[id]/performance
/app/clients/[id]/tickets
/app/clients/[id]/requests
/app/clients/[id]/documents
/app/clients/[id]/reports
```

Functions:

- manage client;
- assign/reassign employees;
- account owner;
- client settings;
- attendance policy;
- performance visibility;
- tickets;
- implementation requests;
- reports.

---

# 45. Team Leader Pages

Team leaders need:

- own employee self-service;
- assigned team dashboard;
- team attendance;
- timesheets;
- schedule;
- leave approval;
- attendance correction approval;
- overtime approval;
- team performance;
- announcements;
- reports limited to assigned team.

---

# 46. Client Portal

Routes can remain inside `/app` and render client navigation based on membership.

```text
/app/client
/app/client/team
/app/client/attendance
/app/client/timesheets
/app/client/performance
/app/client/approvals
/app/client/requests
/app/client/tickets
/app/client/reports
/app/client/documents
/app/client/billing
/app/client/users
/app/client/settings
```

Client dashboard:

- active assigned employees;
- present today;
- attendance rate;
- open tickets;
- pending approvals;
- SLA;
- team status;
- performance snapshot;
- account manager;
- reports;
- billing summary if permitted.

No client may see employee salary/payroll.

---

# 47. Tickets / Requests Pages

Internal:

```text
/app/tickets
/app/tickets/[id]
/app/requests
```

Client:

```text
/app/client/tickets
/app/client/tickets/[id]
/app/client/requests
```

Include:

- category;
- priority;
- status;
- assignment;
- attachments;
- public comments;
- internal notes;
- SLA;
- history;
- resolution;
- reopen rules;
- client satisfaction.

---

# 48. Reports

Create role-aware reports.

## Workforce

- employee count;
- client assignment;
- utilization;
- attendance;
- overtime;
- leave.

## HR

- leave;
- PTO/UPTO;
- NTE;
- cash advances;
- expiring documents.

## Payroll

- period summary;
- employee breakdown;
- overtime;
- deductions;
- commissions;
- adjustments.

## CRM

- pipeline;
- source;
- conversion;
- win/loss.

## Recruitment

- applicants;
- time-to-hire;
- stage conversion;
- sources.

## Client

- attendance;
- timesheets;
- performance;
- tickets.

Exports:

- CSV
- Excel
- PDF where appropriate.

Never export data a user cannot read in-app.

---

# 49. Global Search

Implement permission-aware search.

Search:

- employees;
- clients;
- CRM leads;
- deals;
- applicants;
- tickets;
- documents;
- reports where practical.

Search results must respect tenant/role permissions.

---

# 50. PWA Push Notifications

Implement:

1. permission request only after meaningful user interaction;
2. save push subscription to Supabase;
3. Edge Function/server route sends Web Push;
4. notification center;
5. unsubscribe;
6. device management;
7. user preferences.

iPhone:

- respect Dynamic Island/notch safe areas;
- `env(safe-area-inset-top)` etc.;
- no content hidden under system UI;
- install instructions where useful.

---

# 51. Responsive Standards

Support:

```text
320px small phones
375/390/430px common iPhones
768px tablets
1024px tablets/small laptops
1280px laptops
1440px desktops
1920px large monitors
```

Rules:

- no horizontal page scroll;
- minimum 44x44px touch targets;
- 16px minimum form text on mobile;
- tables become responsive cards/drawers where appropriate;
- use drawers/sheets on mobile;
- use full tables on desktop;
- preserve accessible zoom;
- test portrait and landscape.

---

# 52. Accessibility

Target WCAG AA.

Required:

- semantic HTML;
- labels;
- keyboard navigation;
- visible focus rings;
- contrast;
- accessible modals;
- screen-reader names;
- table semantics;
- status not conveyed by color alone;
- reduced-motion support;
- error messages adjacent to fields;
- skip links.

---

# 53. Error / Loading / Empty States

Every data page needs:

- skeleton/loading;
- empty state;
- error state;
- retry;
- success feedback.

Do not use generic:

> Something went wrong.

Prefer actionable messages.

Critical mutations should show confirmation and prevent duplicate submissions.

---

# 54. Data Fetching

Prefer:

- server components for initial protected data where appropriate;
- server-side Supabase client with cookie auth;
- client queries for interactive/real-time needs;
- typed query functions;
- no raw Supabase calls scattered in components.

Create feature repositories/services.

Generate database types from Supabase.

---

# 55. Forms

Use:

- React Hook Form;
- Zod;
- server-side revalidation;
- visible labels;
- field-level errors;
- loading state;
- mutation idempotency where needed.

Sensitive forms:

- payroll adjustments;
- NTE;
- cash advances;
- client billing;
- role changes;

must require explicit confirmation.

---

# 56. PWA Offline Strategy

Cache:

- static shell;
- fonts;
- logos;
- safe read-only pages where appropriate.

Do not cache confidential data broadly without considering exposure.

Never let stale cached payroll/HR data appear to another logged-in user on shared devices.

Clear sensitive caches on logout.

---

# 57. Realtime

Use Supabase Realtime only where beneficial:

- attendance status;
- notifications;
- ticket updates;
- approvals;
- operational dashboards.

Do not subscribe every page to every table.

Scope channels by organization/user.

---

# 58. Edge Functions / Server Jobs

Use secure server functions for:

- invitation workflows;
- privileged user creation;
- push delivery;
- scheduled reminders;
- payroll finalization side effects;
- payslip generation;
- ticket SLA escalation;
- recurring notifications;
- client report generation.

Service-role access remains server-side only.

---

# 59. Scheduled Jobs

Implement scheduled tasks for:

- shift reminders;
- missing clock-in/out;
- leave reminders;
- payroll cutoff;
- commission cutoff;
- invoice overdue status;
- ticket SLA escalation;
- document expiration;
- contract expiration;
- probation/regularization dates.

---

# 60. Demo / Development Accounts

Create a **development-only** seed script.

Do not hardcode production passwords in the repository.

Use:

```env
DEMO_PASSWORD=
```

Suggested demo emails:

```text
owner@demo.beepabpo.com
superadmin@demo.beepabpo.com
hr@demo.beepabpo.com
recruiter@demo.beepabpo.com
sales@demo.beepabpo.com
marketing@demo.beepabpo.com
operations@demo.beepabpo.com
teamlead@demo.beepabpo.com
finance@demo.beepabpo.com
employee@demo.beepabpo.com
clientadmin@demo.beepabpo.com
clientviewer@demo.beepabpo.com
applicant@demo.beepabpo.com
```

Seed:

- BeePA internal organization;
- one sample client: `CloudPeak`;
- sample employees;
- sample attendance;
- sample leave;
- sample payroll period;
- sample lead/deal;
- sample applicant/job;
- sample tickets.

Demo users must only be created when explicitly running the dev seed command.

---

# 61. Production Account Bootstrap

Provide a script:

```bash
pnpm create-owner
```

It should require environment input for:

- owner email;
- owner name;
- temporary password or invite mode.

Then:

1. create auth user securely via Supabase Admin API;
2. create profile;
3. attach BeePA organization membership;
4. assign Owner role;
5. force password setup/change if using temporary password.

Do the same for Super Admin only when explicitly requested.

---

# 62. Middleware / Route Protection

Protect `/app/**`.

Rules:

- unauthenticated → sign-in;
- invalid/suspended membership → access denied;
- missing permission → 403 page;
- client role accessing internal page → redirect or 403;
- internal role accessing unsupported module → 403;
- applicant → applicant-specific routes only.

Never rely solely on frontend hiding.

---

# 63. Security

Implement:

- RLS everywhere;
- CSRF-safe patterns;
- secure cookies;
- rate limiting for sensitive routes;
- auth abuse protection;
- file type/size validation;
- signed URLs;
- least privilege;
- audit logs;
- session management;
- no secrets in source;
- no sensitive logs;
- secure headers;
- CSP where practical;
- dependency scanning.

Use server-side authorization for every mutation.

---

# 64. Backups / Recovery

Document:

- Supabase database backup settings;
- restore procedure;
- Storage backup strategy for critical documents;
- environment variable backup;
- deployment rollback;
- disaster recovery checklist.

Do not claim backups exist until configured.

---

# 65. Analytics

Public website:

- page views;
- CTA clicks;
- form starts;
- form submits;
- career applications;
- consultation bookings;
- SEO lead source.

Internal product:

avoid invasive employee surveillance.

Track product events only where operationally necessary and privacy-appropriate.

---

# 66. Testing Strategy

## Unit

Test:

- payroll formulas;
- attendance calculations;
- leave balances;
- commissions;
- permissions helpers;
- status transitions.

## Integration

Test:

- Supabase queries;
- RLS;
- approval flows;
- applicant → employee;
- won deal → client;
- attendance → payroll;
- cash advance → payroll deduction.

## E2E

Playwright scenarios:

1. employee login → clock in → leave request → payslip.
2. HR login → approve leave → issue NTE.
3. Finance → process payroll.
4. Sales → create lead → win deal.
5. Recruiter → applicant → hire.
6. Client Admin → view team → approve timesheet → create ticket.
7. Super Admin → invite user → assign role.
8. Cross-client isolation.
9. Unauthorized payroll access.
10. mobile PWA employee flow.

## Accessibility

Use automated axe checks plus keyboard testing.

---

# 67. Critical RLS Tests

Explicitly prove:

```text
Client A cannot read Client B.
Employee A cannot read Employee B payroll.
Employee cannot mutate own finalized payroll.
Marketing cannot read payroll.
Sales cannot read NTE.
Client cannot read payroll salary.
Client Viewer cannot mutate approvals.
Applicant cannot read another applicant.
Suspended user cannot access organization data.
```

Do not declare security complete without these tests.

---

# 68. Performance

Target:

- optimized public LCP;
- no giant client bundles;
- lazy-load dashboard modules;
- virtualize large lists where needed;
- paginate tables;
- server-side filters for large datasets;
- optimized images;
- stable layout to avoid CLS.

Do not fetch 10,000 rows to filter in the browser.

---

# 69. Database Migrations

All schema changes must live in:

```text
supabase/migrations/
```

Never manually change production without recording a migration.

Migration order:

1. enums/extensions;
2. identity/org;
3. roles/permissions;
4. employee/client;
5. attendance;
6. HR;
7. payroll;
8. CRM;
9. recruitment;
10. ticketing;
11. performance;
12. billing;
13. CMS;
14. notifications;
15. audit;
16. RLS;
17. functions/triggers;
18. seed reference data.

---

# 70. Database Functions / Triggers

Implement carefully:

- `updated_at` trigger;
- unique employee number generation if required;
- payroll recalculation helpers;
- leave balance updates;
- ticket number generation;
- invoice number generation;
- audit capture where appropriate;
- permission helper functions.

Avoid hidden business logic spread across dozens of opaque triggers. Document every trigger.

---

# 71. State Machines

Implement explicit transitions.

Examples:

## Payroll

```text
draft
→ preparing
→ review
→ approval
→ finalized
→ disbursed
→ closed
```

## Ticket

```text
new
→ assigned
→ in_progress
→ waiting_for_client
→ resolved
→ closed
```

## Application

```text
applied
→ screening
→ initial_interview
→ assessment
→ client_endorsement
→ client_interview
→ offer
→ hired
```

Prevent illegal jumps unless elevated override is used and audited.

---

# 72. UX Consistency

All dashboards must feel like the same BeePA product.

Reuse:

- same sidebar behavior;
- same search;
- same page header;
- same metric cards;
- same filter bars;
- same tables;
- same status badges;
- same drawer;
- same modal;
- same typography;
- same spacing;
- same chart language.

Role changes affect **information architecture and permissions**, not the entire visual identity.

---

# 73. Dashboard Design Rule

Each role dashboard must answer:

## Owner

> Is the business operating normally?

## Super Admin

> Is the platform secure and healthy?

## HR

> What employee matters require attention?

## Finance

> What payroll/billing work requires action?

## Sales

> Which leads/deals need action?

## Recruiter

> Which candidates/jobs need action?

## Operations

> Which clients/teams need attention?

## Team Lead

> What does my team need today?

## Employee

> What do I need to do today?

## Client

> What is happening with my BeePA team?

Never fill dashboards with charts merely to look like SaaS.

---

# 74. Public Form Workflows

## Build Your Team / Consultation

Creates:

- CRM lead;
- CRM contact/company if appropriate;
- lead attribution;
- notification to Sales.

## Job Application

Creates:

- applicant;
- application;
- resume document;
- recruiter notification.

## Contact

Creates:

- CRM lead or support inquiry based on selected purpose.

Use spam protection/rate limiting.

---

# 75. Email Templates

Create BeePA-branded templates for:

- verify email;
- reset password;
- employee invite;
- client invite;
- application received;
- interview scheduled;
- leave decision;
- cash advance decision;
- payroll/payslip available;
- ticket created;
- ticket updated;
- invoice issued;
- overdue invoice;
- NTE notice.

No sensitive payroll values should be sent in email unless BeePA explicitly wants that.

Prefer links to authenticated portal.

---

# 76. Notifications Preferences

Users can control eligible notifications.

Keep critical security/HR notifications non-optional when legally/business necessary.

Store:

```text
in_app_enabled
push_enabled
email_enabled
category preferences
```

---

# 77. Client-Specific Configuration

A client can configure:

- timezone;
- work days;
- shift;
- grace period;
- break policy;
- overtime;
- holiday calendar;
- client timesheet approval;
- visibility;
- SLA;
- client portal permissions.

Do not hardcode a universal 9–6 schedule.

---

# 78. Attendance Timezone Handling

Official algorithm:

1. schedule defined in an IANA timezone;
2. convert schedule to UTC;
3. clock events recorded in UTC server time;
4. display according to relevant client/employee timezone;
5. calculate late/undertime based on assigned policy;
6. preserve original policy snapshot on finalized attendance/payroll.

Handle overnight shifts correctly.

Example:

```text
10:00 PM → 7:00 AM next day
```

Do not assume same-calendar-date end time.

---

# 79. Payroll Calculation Snapshot

When payroll is calculated, save enough data to reproduce the result.

`calculation_snapshot` should contain:

- rates used;
- attendance totals;
- overtime totals;
- leave;
- allowances;
- commission;
- deductions;
- cash advance;
- formula version.

This prevents historical payroll from changing when employee rates change later.

---

# 80. Privacy Boundaries

Client-visible employee profile should contain only necessary fields.

Never expose by default:

- personal address;
- emergency contact;
- internal salary;
- NTE;
- cash advance;
- internal HR notes;
- personal documents.

Create separate serializers/views for client-visible data.

---

# 81. Supabase Storage Policies

Implement bucket-level policy requirements.

Examples:

### Employee documents

Employee can read permitted own documents.
HR can manage based on permission.

### Payslips

Employee can read only own payslips.
Finance/authorized admin can manage.

### Client documents

Client tenant can read only own client documents.

### Applicant resumes

Applicant can update own application documents before submission if allowed.
Recruiters can access candidates they are permitted to manage.

---

# 82. Database Views

Use secure views/materialized views where useful for:

- executive metrics;
- client attendance summary;
- payroll summary;
- recruitment funnel;
- CRM funnel.

Do not use views to bypass RLS.

Use `security_invoker` where supported/appropriate.

---

# 83. Exports

Every export action must:

1. re-check permission server-side;
2. apply current filters;
3. enforce tenant scope;
4. record audit event for sensitive exports;
5. prevent payroll/client leakage.

For large exports, generate asynchronously and provide time-limited download.

---

# 84. Design Components

Create BeePA-specific reusable components:

```text
BeePAButton
BeePACard
MetricCard
StatusBadge
DataTable
FilterBar
PageHeader
SectionHeader
EmptyState
ErrorState
LoadingSkeleton
EmployeeAvatar
EmployeeCard
ClientCard
AttendanceClock
AttendanceStatus
LeaveBalance
PayrollSummary
ApprovalQueue
TicketTimeline
ActivityFeed
NotificationCenter
WorkspaceSwitcher
CommandSearch
```

---

# 85. Mobile Employee Experience

Employee PWA home should prioritize:

1. today's shift;
2. clock in/out;
3. attendance state;
4. leave balance;
5. next payroll;
6. quick actions;
7. upcoming schedule;
8. announcements.

Quick actions:

- Request Leave
- Cash Advance
- Attendance Correction
- Submit Ticket

No dense executive charts on employee mobile home.

---

# 86. Mobile Client Experience

Prioritize:

- team status;
- pending timesheets;
- attendance;
- open tickets;
- approvals;
- account manager;
- reports.

---

# 87. iOS / Dynamic Island

For all mobile pages:

- use safe-area insets;
- header not obscured;
- bottom nav above home indicator;
- avoid fixed controls directly under Dynamic Island;
- PWA standalone mode tested;
- keyboard does not cover form actions.

---

# 88. Search / Filters / Tables

All large management tables need:

- search;
- sorting;
- filters;
- saved views optional;
- column visibility;
- pagination;
- export where permitted;
- row actions;
- mobile detail drawer.

Do not make desktop tables horizontally unusable on mobile.

---

# 89. Logging / Monitoring

Add:

- structured server logs;
- error boundary;
- optional Sentry;
- Edge Function logs;
- failed job visibility.

Do not log:

- passwords;
- tokens;
- full confidential document content;
- service-role key.

---

# 90. CI/CD

Create GitHub Actions:

## Pull Request

- install;
- typecheck;
- lint;
- unit tests;
- build;
- Playwright smoke tests where practical.

## Database

Provide safe migration workflow.

Production migrations require explicit deployment step.

---

# 91. Definition of Done for Every Page

A page is not complete until:

- real Supabase data;
- role authorization;
- RLS;
- loading;
- empty;
- error;
- success feedback;
- validation;
- responsive mobile/tablet/desktop;
- keyboard accessibility;
- correct branding;
- analytics where relevant;
- tests for critical behavior.

---

# 92. Implementation Phases

## Phase 0 — Audit Existing Scratch

Before deleting anything:

1. inspect files;
2. inspect existing package.json;
3. inspect current routes/components;
4. read brandbook;
5. inspect assets/mockups;
6. write migration plan;
7. preserve working work.

---

## Phase 1 — Foundation

- Next.js architecture;
- Supabase clients;
- Auth;
- organizations;
- profiles;
- roles/permissions;
- RLS;
- app shell;
- brand design tokens;
- audit;
- notifications foundation;
- PWA foundation.

---

## Phase 2 — Website / Careers

- landing;
- about;
- services;
- industries;
- resources;
- careers;
- job details;
- application;
- contact;
- SEO;
- CRM lead intake.

---

## Phase 3 — Employee / Attendance / Leave

- employee profile;
- schedules;
- attendance policies;
- clock;
- attendance records;
- corrections;
- overtime;
- PTO/UPTO;
- leave approval;
- PWA push.

---

## Phase 4 — HR / Payroll

- employee admin;
- NTE;
- cash advances;
- payroll;
- commissions;
- payslips;
- payroll approvals;
- reports.

---

## Phase 5 — ATS / CRM

- recruitment pipeline;
- hiring conversion;
- CRM pipeline;
- deal conversion;
- client onboarding.

---

## Phase 6 — Client Portal / Ticketing

- client tenant;
- assigned team;
- attendance;
- timesheets;
- approvals;
- tickets;
- performance;
- documents;
- billing.

---

## Phase 7 — Advanced Operations

- reports;
- exports;
- billing;
- automation;
- system health;
- admin tools;
- backup/runbooks.

---

# 93. Required Deliverables

At completion, provide:

1. working application;
2. Supabase migrations;
3. RLS policies;
4. database diagram/documentation;
5. generated DB types;
6. seed reference data;
7. dev demo-user seed script;
8. owner bootstrap script;
9. `.env.example`;
10. README setup;
11. deployment guide;
12. backup/restore guide;
13. permission matrix;
14. route map;
15. test suite;
16. audit/security checklist;
17. PWA install/push documentation.

---

# 94. README Requirements

README must explain:

```text
Prerequisites
Environment variables
Supabase setup
Run locally
Run migrations
Generate DB types
Create owner
Seed demo data
Run tests
Build
Deploy
PWA setup
Push notification setup
Backup/restore
Troubleshooting
```

---

# 95. Required Permission Matrix Documentation

Generate:

`docs/PERMISSIONS.md`

Columns:

```text
Module
Action
Owner
Super Admin
HR
Recruiter
Sales
Marketing
Operations
Team Lead
Finance
Employee
Client Admin
Client Viewer
Applicant
```

Explicitly distinguish:

- full;
- scoped;
- own;
- read;
- approve;
- none.

---

# 96. Required Database Documentation

Generate:

`docs/DATABASE.md`

Document:

- every table;
- purpose;
- key columns;
- FK relationships;
- RLS summary;
- triggers/functions;
- indexes;
- retention.

Generate Mermaid ER diagram if useful.

---

# 97. Required Workflow Documentation

Generate:

`docs/WORKFLOWS.md`

Include:

- Employee onboarding
- Client onboarding
- Lead → Client
- Applicant → Employee
- Attendance → Timesheet
- Timesheet → Payroll
- Leave
- Cash Advance
- NTE
- Payroll
- Commission
- Ticket
- Client approval
- Invoice

---

# 98. Required Security Documentation

Generate:

`docs/SECURITY.md`

Include:

- auth;
- RLS;
- service-role handling;
- secrets;
- storage;
- session management;
- tenant isolation;
- audit;
- backups;
- incident response;
- production checklist.

---

# 99. Final AI Execution Instruction

When implementing this project:

1. Do not skip database migrations.
2. Do not mock a page when backend functionality is required.
3. Do not invent new brand colors.
4. Do not create duplicate role-specific apps.
5. Do not use separate employee/admin auth stores.
6. Do not expose privileged Supabase keys.
7. Do not disable RLS.
8. Do not allow self-service privilege escalation.
9. Do not create client-facing APIs without tenant checks.
10. Do not hardcode attendance schedules.
11. Do not hardcode payroll tax logic.
12. Do not make payroll visible to clients.
13. Do not claim a module is complete without test coverage for its critical paths.
14. Do not replace existing brand assets unless explicitly instructed.
15. Do not leave placeholder data after connecting a module to Supabase.

Prioritize:

```text
Security
→ Data integrity
→ Correct workflows
→ UX clarity
→ Accessibility
→ Responsive behavior
→ Performance
→ Visual polish
```

---

# 100. Start Here

Execute in this order:

```text
1. Audit current repository.
2. Read Branding/01_MASTER_BRANDBOOK.md.
3. Read Branding/11_AI_IMPLEMENTATION_RULES.md.
4. Inspect Assets and Mockup.
5. Confirm/install required dependencies.
6. Configure Supabase environment.
7. Create migration plan.
8. Implement identity/org/role schema.
9. Implement RLS before business data is exposed.
10. Implement auth + workspace routing.
11. Build BeePA app shell/design system.
12. Build public landing/auth pages.
13. Build modules phase-by-phase.
14. Add test coverage continuously.
15. Generate documentation.
16. Run full production readiness checklist.
```

## End state

The finished product must feel like **one coherent BeePA operating platform**:

> **Public Website + SEO + CRM + Careers/ATS + Client Management + Employee HRIS + Attendance + Leave + NTE + Cash Advances + Payroll + Commissions + Client Portal + Ticketing + Billing + Reports + PWA + Push Notifications**

all running securely under:

> **`https://beepabpo.com`**

with Supabase as the backend and BeePA's **People. Partnership. Progress.** brand system applied consistently across every user and every screen.
