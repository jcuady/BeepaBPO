# Changelog

Phased delivery of the Beepa BPO platform (not semver releases).

## DB apply + list pagination (2026-09-14)

- Applied `20260914120000` on Beepa project `nwvnawgxkzwiercllgmg`: attendance/CRM indexes and `supabase_realtime` publication for attendance, CRM, tickets, and job applications. Replica identity on attendance left default (follow-up only if clock-out live refresh fails).
- URL `page` + shared `ListPager` on staff tickets/employees/CRM leads/deals/leave/applicants, client tickets, and admin users. Queries use `.range` instead of a silent `.limit`.

## Shell latency + live data (2026-09-14)

- Workspace resolve now loads profile, memberships, and `user_permission_codes` in one `Promise.all` (was 3 sequential round-trips).
- App layout no longer waits on unread notification count; the bell already fetches live.
- Loading skeletons use white cards so CRM/hubs no longer look blank on `bg-mist`.
- Employee `/app/my/attendance` has Clock In / Out (same `clock_event` action as My Workspace).
- Debounced realtime refresh on attendance, CRM hub, and staff tickets. Migration `20260914120000` (indexes + `supabase_realtime`) is applied on `nwvnawgxkzwiercllgmg`.
- Header role label prefers Sales/HR over generic Employee across all memberships (not only the primary row).
- Live refresh also on client tickets, employee requests, and applicant applications (scoped filters).

## Auth + shell

Supabase Auth, employee vs client login, workspace resolution, app shell/sidebar, permission helpers (`can` / `requirePermission`), marketing + auth layouts.

**2026-09-09 — Auth UI redesign:** `/login`, `/employee/login`, and `/signup` rebuilt to match `Mockup/sign in.png` and `Mockup/sign up.png` (split brand panel + form card, values bar, mobile form-first + photo strip). Demo login pickers kept. OAuth deferred (honest copy, no decoy Google CTA). Remember-me persists email locally on client login.

**2026-09-09 — SEO / Search Console:** Favicons regenerated as real multi-size ICO + 48px PNG (Google favicon guideline). Root title/OG set to `BeepoBPO | People-First BPO Outsourcing Partner`. Organization + WebSite JSON-LD, optional `GOOGLE_SITE_VERIFICATION`, contact UTM attribution, honest “Built for growing teams” strip (no fake client logos).

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
- Auth lock: email/password confirmed as intentional path; OAuth deferred in status/docs; cash-advance audit `entityType` aligned to `cash_advance`
- Ticket assignment: `assignTicket` + `TicketAssignForm` on `/app/tickets/[id]`; assignee column on queue; Beepa internal assignee list; notify assignee
- SLA policy admin: `/app/tickets/sla` create/update Beepa `ticket_sla_policies` (`tickets.manage`); nav link under Tickets
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
- CMS edit-in-place: `updateBlogPost` / `updateService` / `updateFaq` / `updateIndustry` / `updateTestimonial` / `updateCaseStudy` + `CmsEditButton` dialogs on `/app/cms`
- Invoice issue UI: `issueInvoice` + `IssueInvoiceForm` on `/app/billing` (`billing.manage`); creates `issued` invoice + line item
- Deal → client org: `convertWonDealToClient` on won deals (`crm.manage` + `clients.manage`); migration `20260907190000` adds `crm_deals.client_organization_id`
- Payroll period create: `createPayrollPeriod` + form on `/app/payroll/periods` (`payroll.manage`); optional draft `payroll_records` for active employees
- CRM proposals: `createCrmProposal` / `updateCrmProposalStatus` on `/app/crm/proposals` + deal detail; early deals bump to `proposal` stage
- Email digests: Resend HTTP send (`lib/email/send.ts`), cron `notification_digest`, pref toggle on `/app/my/notifications`; migration `20260907200000` (`email_digest_sent_at`)
- Dynamic approval workflows: `lib/approvals/engine.ts` resolves by workflow `code` + advances steps; leave/cash/attendance wired; admin read view `/app/admin/workflows`
- Current-step Approve gating: `mapPendingApprovalActability` + `canActOnApprovalStep` hide Approve on leave/cash/corrections/`/app/approvals` when the actor is not on the current workflow step (shows “Waiting for …”)
- Client ticket SLA: seed policies + `tickets_apply_sla` trigger (`20260907210000`); `evaluateTicketSla` / compliance tile on `/app/client`; SLA column on `/app/tickets`; detail badges; first staff reply sets `first_response_at`
- Auth lock: email/password confirmed as intentional path; OAuth deferred in status/docs; cash-advance audit `entityType` aligned to `cash_advance`
- Ticket assignment: `assignTicket` + `TicketAssignForm` on `/app/tickets/[id]`; assignee column on queue; Beepa internal assignee list; notify assignee
- SLA policy admin: `/app/tickets/sla` create/update Beepa `ticket_sla_policies` (`tickets.manage`); nav link under Tickets
- Account menu fix: `DropdownMenuLabel` wraps Base UI `Menu.Group` (fixes MenuGroupContext crash); header menu adds Profile / Settings / Notifications / Sign out
- Payroll period approval: `submitPayrollPeriodForApproval` + `reviewPayrollPeriod` on `/app/payroll/periods/[id]`; Finance → Owner via seeded `payroll` workflow; approvals hub deep-link
- CI permanent fix: quote `AUTH_SECRET` (YAML `!!` broke every run); e2e gated on `vars.RUN_E2E` not `secrets.*`
- Account honesty: `/app/my/settings` password; client/applicant notification inboxes; gate client Create/Reply ticket; cash advances in employee nav; payroll perms on Approvals
- Role audit: employee ticket detail `/app/my/requests/[id]`; remove clock location decoy; client profile edit; filter client Approvals nav; DB revoke anon on SECURITY DEFINER + indexes (`docs/ROLE_CHECKLIST.md`)
- Principal system audit: leave cancel `ConfirmDialog`; client portal flags (`allow_ticketing` / billing / attendance) on nav + pages + `createTicket`; honest marketing Trusted-by / ProofStrip; admin orgs/workflows view-only copy; `docs/SYSTEM_AUDIT.md` + `tests/principal-audit-p1.test.ts`
- Principal remaining P2: HR `updateEmployee` + edit form; admin membership role change + revoke (owner/super_admin protected); ConfirmDialog on payroll recalculate + send-to-client; `postTicketMessage` hard-lock when ticketing off (staff bypass); orgs/workflows stay RO; `tests/principal-remaining-p2.test.ts`
- Landing redesign: hero matches mockup (green arc + side banner + trust strip); Why Beepa copy/layout; tab title `BeepoBPO` + brand favicons regenerated from SVG
