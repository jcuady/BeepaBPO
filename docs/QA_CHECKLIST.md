# QA checklist

Use seeded demo users (`pnpm seed:demo`) and `DEMO_PASSWORD`. Full gate: [TEST_PLAN.md](./TEST_PLAN.md).

## Automated (e2e / unit)

Run: `pnpm test` · `pnpm test:e2e`

- [ ] Unit: attendance, permissions, workspace-flags, safe-next, landing (`pnpm test`)
- [x] E2E roles: 13 demo landings + segment isolation + open-redirect block (`e2e/roles.spec.ts`) — verified 2026-09-07
- [x] E2E a11y: login / my / client / dashboard / applicant — no serious/critical (`e2e/a11y.spec.ts`) — verified 2026-09-07
- [x] E2E filters: tickets + applicants + CRM + leave query params (`e2e/filters.spec.ts`) — verified 2026-09-07
- [x] E2E mutations: employee leave submit + approve confirm cancel + ticket validation (`e2e/mutations.spec.ts`) — verified 2026-09-07
- [x] E2E demo-ready: auth guards + landmines (`e2e/demo-ready.spec.ts`) — verified 2026-09-07
- [ ] Typecheck / lint / build (`pnpm typecheck && pnpm lint && pnpm build`)

## Manual — per-role login & nav

For each of the 13 demo emails:

- [ ] Correct login path (`/employee/login` vs `/login`)
- [ ] Lands on expected home
- [ ] Sidebar shows expected primary tree
- [ ] Admin groups match role permissions (or none for client/applicant)

Cross-checks (also covered by e2e when secrets present):

- [ ] Client cannot sign in via `/employee/login`
- [ ] Employee redirected away from `/app/client/*`
- [ ] Client redirected away from `/app/my/*`
- [ ] Applicant redirected away from `/app/my` and `/app/client`
- [ ] `?next=//evil.com` does not open-redirect off-site

## Manual — protected routes

- [ ] Unauthenticated `/app/employees` → `/login`
- [ ] Employee without `system.manage` opening `/app/admin` → forbidden
- [ ] Employee without `recruitment.read` opening `/app/recruitment/jobs` → forbidden
- [ ] Client Viewer can open team/attendance; billing may be empty without `billing.read`

## Manual — filters

- [ ] Tickets: `?status=` / `?priority=` / `q` update URL and rows
- [ ] Applicants: `?stage=` / `q`
- [ ] CRM leads, leave, cash-advances, audit, client attendance, employees search

## Manual — mutation smoke

- [ ] Clock in/out on `/app/my/attendance`
- [ ] Submit leave on `/app/my/leave` (confirm dialogs on approve path for HR)
- [ ] Submit cash advance; HR reviews `pending` / `hr_review` / `finance_review`
- [ ] HR creates NTE; employee responds; field errors visible
- [ ] Recruiter moves application stage **with confirm** (cancel does not mutate)
- [ ] Ticket status change **with confirm**
- [ ] Sales creates CRM lead; Reset clears form
- [ ] Client creates ticket; message on detail
- [ ] Finance payroll recalculate (if data)
- [ ] Approvals Review links: leave → `/app/leave`, cash advance → `/app/cash-advances`, ticket → detail
- [ ] Marketing: publish industry/testimonial/FAQ/service/post/case study on `/app/cms`; check `/about`, `/contact`, `/services`, `/resources`, `/case-studies`
- [ ] Sales: create deal on `/app/crm/deals` or from lead; stage move with confirm (lost requires reason)
- [ ] Ops/Owner: invite client_admin/viewer on `/app/clients` for an active client org

## Manual — accessibility polish

- [ ] Focus rings visible; controls ≥ 44px on primary actions
- [ ] Skip link on marketing layout
- [ ] Form-heavy pages keyboard-usable

## Manual — PWA / push

- [ ] `/manifest.webmanifest` loads
- [ ] Service worker registers in app shell
- [ ] Notifications: preference toggle + push (needs VAPID)

## Release ops

- [ ] Migrations applied including hardening
- [x] Cron secret set; smoke `POST /api/jobs/cron` (`pnpm smoke:cron` / Admin Ops smoke)
- [ ] Auth redirect URLs include `/auth/callback` and `/reset-password`
- [ ] Backlog items in [TEST_PLAN.md](./TEST_PLAN.md) §9 remain unchecked until built
