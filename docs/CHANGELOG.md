# Changelog

Phased delivery of the Beepa BPO platform (not semver releases).

## Auth + shell

Supabase Auth, employee vs client login, workspace resolution, app shell/sidebar, permission helpers (`can` / `requirePermission`), marketing + auth layouts.

## Employee pages

`/app/my` home, attendance (clock), schedule, leave, payroll self-view, requests, documents, profile, notifications, support.

## Client portal + RLS

`/app/client` tree, tenant-scoped views (`client_visible_employees`, attendance summaries), tickets, billing read, client settings; RLS helpers for client isolation.

## HR / payroll / recruitment / CRM hubs

Internal hubs: HR, payroll periods, recruitment jobs/applicants, CRM leads, clients list, tickets, reports, approvals queue.

## ATS / CRM / careers

Job posts, applications, public careers apply, applicant membership + portal, CRM lead create, stage history tables.

## Admin / reports / cron

Owner dashboard, admin users/orgs, reports snapshot, push APIs, `POST /api/jobs/cron` with `CRON_SECRET`.

## DB optimization

Indexes and covering membership lookups (`20260906001300`), applicant `membership_type`, hot-path filters for leave/tickets/jobs/attendance; clock/attendance event hardening.

## Hardening pass

- Segment layouts: `my` / `client` / `applicant` membership gates
- `safeNext` on login/callback redirects
- `audit_logs` writes via `logAudit`; insert policy `actor_user_id = auth.uid()` (`20260906001400_hardening.sql`)
- NTE create/respond + HR/employee pages
- Detail pages: employees, tickets, payroll periods, recruitment applicants
- Playwright role + a11y suites
- Documentation set under `docs/`

## UI polish + honesty pass

- FilterBar wired on hot queues; `lib/app/search-params.ts`; employees DB search via ilike + profile trgm
- Dense queues → Table + StatusBadge; ConfirmDialog on ticket/stage/leave/cash-advance mutations
- `applyFieldErrors` on RHF server actions; toast error fallbacks; cash-advance review for open review statuses
- Approvals deep links; admin hub links; client SLA tile removed; PageContainer on hubs
- Docs honesty + `docs/TEST_PLAN.md`; e2e `filters` + `mutations` specs

## Demo-harden pass (Option A)

- Fixed employees name search (`profile_id`); sanitized `ilike` filters; leave queue limit
- Approvals Review only when caller can open the queue; Approvals nav requires real queue perms
- Superadmin Jump-in is permission-filtered (no forbidden Employees/Tickets)
- Honest copy on payroll/documents/jobs/client approvals
- Seed: payroll_records, applicant application, KPIs, document metadata rows
- E2E: `demo-ready.spec.ts` + expanded filters/mutations; `docs/DEMO_SCRIPT.md`

## Product backlog slices (2026-09-07)

- Public contact → CRM via admin client
- Attendance correction review queue + Approvals deep-link
- Hire convert + invite (`convertApplicantToEmployee`)
- Storage upload + signed download (`lib/documents/actions.ts`); client insert migration `20260907140000`
- Payslip PDF download (`lib/payroll/payslip-pdf.ts` + route)
- Favicon + SEO (app/public `favicon.ico`, PNG icons, metadata icons/OG/robots, sitemap careers, JSON-LD logo)
- Job post update / publish / close (`updateJobPost`, `publishJobPost`, `closeJobPost` + `/app/recruitment/jobs/[id]`)
- Invoice detail + payments (`/app/billing`, `/app/client/billing/[id]`, `recordInvoicePayment`)
- CRM lead status update (`updateCrmLeadStatus` + `/app/crm/leads/[id]`)
- Reports CSV export (`GET /app/reports/export?dataset=…`, `reports.export`)
- Auth trust: removed decoy Google/Microsoft CTAs (email/password only until OAuth is configured)
- NTE close-out (`resolveNteCase` + `NteResolveForm` on `/app/hr/nte`; outcome on `/app/my/nte`)
- Admin invite (`inviteInternalUser` + `/app/admin/users`; shared `inviteOrResolveAuthUser`)
- Cron/push ops smoke (`lib/jobs/cron-jobs.ts` dry-run, `/app/admin` Ops smoke, `pnpm smoke:cron`); applied `20260907140000` on Beepa remote
- CMS admin (`/app/cms`, `cms.manage`) for services + blog posts; public `/services` + `/resources`/[slug]; sitemap blog URLs
- CRM deals pipeline (`createCrmDeal`, `updateCrmDealStage`, `/app/crm/deals`, lead→deal)
- CMS About + FAQs (`public_about`, `createFaq`; migration `20260907170000` for public_* RLS)
- Client org invite (`inviteClientUser` on `/app/clients`, `clients.manage`)
- Remaining CMS pages: industries, testimonials, case studies (`/case-studies`)
- E2E suite green (`pnpm test:e2e` — 34 passed) + honesty pass: removed dead Remember-me / email-pref switch; client approvals/settings/timesheets/payroll/billing empty-copy clarified; home FAQ prefers published CMS rows
- Client timesheet approval: `reviewClientTimesheet` / `submitTimesheetForClientReview`, migration `20260907180000` (`attendance_record_id` on summary + enable `allow_timesheet_approval`), UI on `/app/client/approvals` + timesheets + internal Send to client
- Demo login picker: all 13 roles on `/login` + `/employee/login` autofill (`DEMO_PASSWORD`); seed syncs Supabase Auth passwords via `updateUserById`; e2e `demo-login.spec.ts`
