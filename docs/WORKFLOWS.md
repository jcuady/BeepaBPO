# Workflows

## Employee onboarding

**Intended:** HR creates employee → invite auth user → profile linked → membership + employee role → optional client assignment.

**Today:** Hire convert from ATS covers invite + employee row; **Admin invite** on `/app/admin/users` (`inviteInternalUser`, `system.manage`) sends Supabase invite + internal membership/role (not owner/super_admin). Bulk seed still used for demo users.

## Documents

**Intended:** Upload to private Storage → `documents` metadata → signed download for authorized readers.

**Today:** `uploadEmployeeDocument` / `uploadClientDocument` + `getDocumentDownloadUrl` (15m signed URL, user JWT). Paths `{employee_id|client_org_id}/…`. Client upload RLS: migration `20260907140000_documents_client_insert.sql` (apply on Beepa remote).

## Client onboarding

**Intended:** Won CRM deal or Ops creates client org → `client_profiles` / settings → invite Client Admin → tenant RLS applies.

**Today:** Orgs/settings readable; **client portal invite** on `/app/clients` (`inviteClientUser`, `clients.manage`) sends Supabase invite + client membership + `client_admin`/`client_viewer`. **Won deal → client org** via `convertWonDealToClient` on `/app/crm/deals/[id]` (`crm.manage` + `clients.manage`) creates org + `client_settings` (+ `billing_accounts` when caller also has `billing.manage`).

## Applicant → Employee

**Intended:** Recruitment moves application to `hired` → Convert creates `employees` row, preserves applicant history, invites internal account.

**Today:** `convertApplicantToEmployee` on applicant detail (`recruitment.manage` + `employees.manage`) invites/links auth user, internal membership + employee role, creates `employees`, sets stage `hired`.

## Attendance → Timesheet → Payroll

`clock_event` writes immutable `attendance_events` and daily `attendance_records` → corrections via approval (request + **review at `/app/attendance/corrections`**) → finalized attendance feeds `payroll_records.calculation_snapshot`.

**Payroll periods:** Finance with `payroll.manage` creates cycles on `/app/payroll/periods` (`createPayrollPeriod`, status `draft`). Optional seed inserts draft `payroll_records` for active Beepa employees; recalculate uses `calculate_payroll_record` on period detail.

**Payroll period approval:** From `/app/payroll/periods/[id]`, Finance submits (`submitPayrollPeriodForApproval` → status `approval`, workflow code `payroll`, entity `payroll_period`). Step 1 Finance (`payroll.manage`) then step 2 Owner (`payroll.approve`) use `reviewPayrollPeriod` / `advanceApprovalRequest`. Reject → `review` (resubmit). Final approve → period + non-void records `finalized`. Approvals hub deep-links `payroll_period`. Current-step gating via `mapPendingApprovalActability`.

**Payslip PDF:** `GET /app/my/payroll/[recordId]/payslip` streams a generated PDF for self (`payroll.self`) or `payroll.read`/`manage` after status is approved/finalized/paid.

## Leave

Employee submits → approval workflow steps from DB (`leave`: Team Lead → HR) → intermediate `manager_approved` then `approved` → notify employee → balances adjusted. Approvers use `/app/leave` with confirm dialogs; **Approve buttons only when `canActOnApprovalStep` for the current step** (else “Waiting for …”).

## Cash advance

Employee request → HR review (`hr_review`) → Finance (`finance_review`) via cash_advance workflow steps → deductions on payroll. Queue shows Approve only for the **current** step actor (else “Waiting for …”); server enforces the same gate.

## NTE

1. HR (`nte.manage`) creates case on `/app/hr/nte` → `createNteCase` inserts `nte_cases` (`status: issued`) + `logAudit` (`nte.create`).
2. Employee (`nte.self`) opens `/app/my/nte` → `submitNteResponse` inserts `nte_responses`, sets case `under_review`, audits `nte.respond`.
3. HR resolves open cases (`issued` / `awaiting_response` / `under_review`) via `resolveNteCase` → `status: resolved`, resolution fields, optional `disciplinary_actions` (skipped when `cleared`), audits `nte.resolve`. Employee sees outcome on `/app/my/nte`.

## Application stage move

Recruiter (`recruitment.manage`) on `/app/recruitment/applicants/[id]` calls `updateApplicationStage` (confirm dialog): updates `job_applications.stage`, appends `application_stage_history`, audits `application.stage_update`.

## CRM lead status

**Today:** Sales (`crm.manage`) updates status on `/app/crm/leads` or `/app/crm/leads/[id]` via `updateCrmLeadStatus` (confirm dialog): writes `crm_leads.status`, optional note append, inserts `crm_activities` note, audits `crm_lead.status_update`.

## CRM deals pipeline

**Today:** Sales (`crm.manage`) creates deals on `/app/crm/deals` or from lead detail (`createCrmDeal` → `crm_deals` + activity). Stage moves via `updateCrmDealStage` (confirm; lost requires reason). Proposals on `/app/crm/proposals` and deal detail (`createCrmProposal`, status draft→sent→accepted/rejected/withdrawn). Won deals convert to client orgs via `convertWonDealToClient`. Hub `/app/crm` shows deal + proposal counts.

## Job post lifecycle

**Today:** Create on `/app/recruitment/jobs`; edit on `/app/recruitment/jobs/[id]`; `publishJobPost` / `closeJobPost` / `updateJobPost` (all `recruitment.manage`). Closed jobs leave public `/careers` (anon/authenticated published-only select).

## Tickets

Requester creates → insert trigger attaches Beepa `ticket_sla_policies` by priority (`sla_policy_id`, `sla_due_at`) → staff with `tickets.manage` can **assign** via `assignTicket` (`assigned_user_id`; `new` → `assigned`) → messages (client-visible) vs internal notes → first staff public reply sets `first_response_at` → status changes with confirm → resolve/close. SLA state on staff + client ticket UIs; client dashboard compliance % from tickets with `sla_due_at`. **SLA policy admin** at `/app/tickets/sla` edits targets for **new** tickets only.
## Invoice

**Intended:** Finance issues invoice for client org → payments recorded → overdue job marks `sent` past due as `overdue`.

**Today:** Finance issues invoices on `/app/billing` via `issueInvoice` (`billing.manage`); client + finance detail (`/app/client/billing/[id]`, `/app/billing/[id]`); `recordInvoicePayment` updates status to `partially_paid` / `paid`. Overdue cron still marks past-due sent invoices.

## Reports export

**Today:** `/app/reports` shows snapshot counts (`reports.read` \| `reports.export`). CSV download at `GET /app/reports/export?dataset=snapshot|employees|attendance|tickets|leads` requires `reports.export`, uses the user JWT (RLS-scoped rows, 2k cap), audits `reports.export`. Read-only roles see honest copy that export is unavailable.

## Auth sign-in

**Today:** Email/password on `/login`, `/signup`, `/employee/login` (plus forgot/reset). **Social OAuth is deferred** — provider buttons are not rendered (no decoys). `/auth/callback` still supports code exchange if OAuth is enabled later.

## Cron + push

**Today:** `POST /api/jobs/cron` (Bearer / `x-cron-secret`) runs `missing_clock_out` + `invoice_overdue` + `notification_digest`. `dryRun: true` counts only. Digests email unread notifications via Resend when `RESEND_API_KEY` is set (throttled ~daily per user; respects `email_enabled`). Admin Ops smoke on `/app/admin` runs dry-run + self test push (`system.manage`). Push subscribe/unsubscribe via `/api/push/*`; enable UI on `/app/my/notifications`. Local: `pnpm smoke:cron`.

## CMS publish

**Today:** Marketing (`cms.manage`) on `/app/cms`:
- About → `site_settings.public_about` → `/about`
- Industries + testimonials → `/about` sections
- FAQs → `/contact`
- Services → `/services`
- Blog posts → `/resources` (+ `/[slug]`)
- Case studies → `/case-studies` (+ `/[slug]`)
Create draft → Publish/Archive via `setCmsContentStatus`. RLS: `20260907170000` for `public_%` settings. Edit-in-place for existing rows still deferred.
