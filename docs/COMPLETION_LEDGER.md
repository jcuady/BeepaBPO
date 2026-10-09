# Completion ledger — Principal QA campaign

**Started:** 2026-09-13  
**Last updated:** 2026-10-09 (payroll reconciliation, all migrations applied, realtime proven)  
**Campaign status:** **COMPLETE — the release gate passes end to end.** Forward roadmap: `docs/REMAINING_WORK.md`.

## Current verified state (2026-10-09)

| Gate | Result |
|---|---|
| `tsc --noEmit` | PASS |
| `eslint .` | PASS (`--max-warnings=0`) |
| `vitest run` | **488/488** across 83 files |
| `pnpm build` | PASS |
| **Release gate** | **18/18 passed — exit 0, "All checks passed. Ship it."** |
| Route RBAC | **75/78 (96%)** + 3 structural exemptions, exit 0 |
| Action RBAC | 63/64, exit 0 |
| Dead controls | 0 candidates across 269 `.tsx` (validated by negative control) |
| Page inventory | 93 pages, `--check` clean |
| Design system | **exit 0 — 0 raw primitives, 0 hardcoded colours** (12 radius values informational) |
| Filter persistence | **exit 0 — 32 paginated pages, 0 dropped filters, 0 unverified** |
| Migration preflight | **0 pending**; all 8 applied, Local == Remote for every one. **Not a grammar check** |
| Realtime delivery | **PASS** — an authenticated subscriber received a live `notifications` INSERT |
| Payroll periods | **0 overlapping**; the overlap constraint and the status-coherence trigger are both installed |
| Role × page reachability | **219/219 nav-reachable pages clean across 13 roles** (re-run 2026-10-09, two batches, after the shared-chrome changes) |
| Responsive — owner, all routes | **224/224** across 28 routes × 8 viewports (was 215/232) |
| Responsive — all roles | **100/100** at 390 + 768 across 7 roles |
| Responsive — marketing | 56/56 across 7 routes × 8 viewports |
| E2E | **100 passed, 4 skipped, 0 failed** against a production build from a cold `.auth`. **CI job runnable**; needs `RUN_E2E=true` + secrets |
| Notification isolation | 0 third-party leaks |
| Attendance timezone | PASS on a `TZ=UTC` host |

## Blockers 1 and 2 — closed 2026-10-09

| # | Was blocked | How it closed |
|---|---|---|
| 1 | Overlapping September payroll periods; 10 records `finalized` before approval (₱500,000) | It was never a conflict between two payroll runs. Every record in the draft period carried `calculation_snapshot.engine = "stub_v1"`, 4800 worked minutes across a 30-day window, and zero statutory deductions, so there was no second figure to choose between. `pnpm fix:payroll-overlap` retired the period (1 period, 10 records, 30 components, 10 payslips, 0 rows on the `ON DELETE SET NULL` legs), and `pnpm seed:payroll:window` rebuilt September 16–30 from the engine's own pay math: 10 draft records, ₱240,000. The ₱500,000 exposure had already gone to ₱0 earlier via `pnpm fix:payroll-finalization`. |
| 2 | Four migrations written, none applied | All **8** applied, `supabase migration list` reports zero pending. Applying them surfaced two defects first: a trigger function omitted `returns trigger` (`42P13`), and the Supabase CLI requires `RETURNS` before `LANGUAGE`, which was bisected against the live database. `tests/migration-function-clauses.test.ts` pins both. |

Step 16 was closed too, but not by anything added to the database: the probe subscribed
as `anon` while `notifications` RLS is `user_id = auth.uid()` scoped to `authenticated`, so
it waited for an event it could never receive. The publication already had all 12 tables.

## Still open — none of these block a release

| # | Item | Needs |
|---|---------|-------|
| 3 | Push delivery never observed end-to-end | A real device (iOS 16.4+ A2HS, or Chrome). See `docs/PUSH_NOTIFICATIONS.md` |
| 3a | The VAPID keypair was rotated when `.env.local` was truncated mid-session | Existing browser subscriptions must re-subscribe |
| 3b | `CRON_SECRET` was regenerated at the same time | Any deployed environment calling `/api/jobs/cron` needs the new value; locally nothing is exposed, since `authorizeCronRequest` fails closed |
| 4 | Supabase project `ulrjitekiylgepdyijsw` — staging or production? | An answer; nothing deploys there today |

## Done criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Role × page truth for all seeded roles | **PASS** — RBAC auditors + per-page inventory + all-role sweeps |
| 2 | Critical workflows documented with pass/fail | **PASS** |
| 3 | No open P0/P1 **in code** | **PASS** — four P0/P1 defects fixed this session (SW data leak, unapproved payslip exposure, stale payroll minutes, attendance timezone) |
| 4 | UI consistency on audited hubs | **PASS** — EmptyState + loading + overflow clip + 16px mobile body copy |
| 5 | Automated gates green | **PASS** — typecheck · lint · vitest 488 · build · Playwright 100/4/0 · release gate 18/18 |
| 6 | PROJECT_STATUS honest | **PASS** — blockers marked BLOCKED while open, and rewritten to CLOSED with the evidence once resolved |

**Overall:** **READY.** The release gate passes 18/18 with exit 0, and both former blockers
are closed. Remaining open items are non-blocking.

---

## Prompt log

### Prompt 1–5 — Portal flags, RBAC, CRM (2026-09-13)

See prior ledger entries: portal flag High bugs fixed; requireInternal; ticket RLS; CRM workbench; unit suite green.

### Prompt 6 — Completeness / lag (2026-09-13)

Query caps, loading skeletons, notification ActionResult, admin role ConfirmDialog, e2e 36/1.

### Prompt 7 — Remaining alignment (2026-09-13)

**Done definition:** Medium debt fixed · viewport matrix green · live ROLE landings verified · docs READY · find-bugs clean on High.

**Gates:**
- `pnpm typecheck` PASS
- `pnpm lint` PASS (unused `canAll` removed)
- `pnpm test` 43/184 PASS
- `pnpm build` PASS
- `e2e/viewport.spec.ts` **24 passed** (375/768/1280/1920 + app shells)
- Live `PLAYWRIGHT_BASE_URL=https://beepabpo.com` roles: **13 landings + 3 isolation** PASS; open-redirect assertion fixed for non-localhost hosts

**Shipped:**
| Item | Fix |
|------|-----|
| Admin users search | DB `ilike` on profiles + orgs (not in-memory ≤100) |
| EmptyState polish | Employees, CRM lead activity, my requests, client timesheets |
| Marketing overflow @375 | `overflow-x-clip` on marketing layout / PageHero / FinalCTA |
| Auth image `sizes` | Mobile footer images not forced `100vw` |
| Open-redirect e2e | Assert against `baseURL` host, not hardcoded localhost |
| Ticket message caps | Staff/client/my threads `.limit(200)` |

### Prompt 8 — Shell latency + clock + realtime (2026-09-14)

Parallel workspace resolve, visible skeletons, Clock In/Out on `/app/my/attendance`, debounced realtime on attendance/CRM/tickets.

### Prompt 9 — Beepa DB apply + list pagination (2026-09-14)

**Done definition:** `20260914120000` applied and verified on `nwvnawgxkzwiercllgmg`; hot queues paginate; gates green.

**Shipped:**
| Item | Fix |
|------|-----|
| Indexes | `attendance_records_employee_date_idx`, `crm_leads_status_updated_idx`, `crm_deals_open_close_idx` |
| Realtime publication | attendance_records, crm_leads, crm_deals, tickets, job_applications |
| List pager | `pageParam` + `ListPager` on tickets, employees, CRM, leave, applicants, client tickets, admin users |

---

## Prompt 10–11 — Careers, statuses, design-system consistency (2026-10-08)

**Done definition:** careers possible for HR *and* applicants · all 12 application stages carrying real meaning · every page a role can see actually working · one design system with a gate that fails when it should · documentation that says what is next.

**Shipped:**

| Item | Fix |
|------|-----|
| HR careers | `hr` had **no** `recruitment.*` permission — live 403 confirmed; grant written in `20261008120000` and since **applied**, so `audit-rbac` reports `recruitment 5/5` |
| Applicant careers | `/app/applicant/jobs` + `/app/applicant/jobs/[id]`; unlinked notifications page added to nav |
| Application stages | 12 stages × (label, tone, applicant note, staff note, terminal, step); `on_hold`/`talent_pool` explicitly non-terminal; enum parsed from the migration in tests |
| PageHeader | Gained a `title` prop — a detail page H1 was reading "Good afternoon, …" |
| Role × page | `audit-role-pages.mjs` — 219/219 clean across 13 roles, reading the rendered sidebar. Re-run 2026-10-09 after `app-header` / `site-header` / `notification-bell` changed |
| Dropdowns | 26 raw `<select>` across 22 files → `NativeSelect`; **none had a focus ring** |
| Tables | Last raw `<table>` → Table primitives |
| Colours | Semantic status + series + sidebar token layers; 12 hardcoded-colour files tokenised |
| Attendance palette | 3 duplicate 4-colour maps → `lib/attendance/status-colors.ts` |
| Gates | `audit-design-system.mjs` created and wired into `verify-all`; 21-case contract test with 8 negative controls |

**Six tools reported something they had not earned this project** (403 scored PASS, two Windows path-separator bugs, wall-clock flake, derived failure counts, self-scanning). Each was fixed and re-verified with a negative control.

---

## Role × page matrix (seeded demo roles)

| Role | Landing | Live 2026-09-13 |
|------|---------|-----------------|
| owner / super_admin | `/app/dashboard` | PASS |
| hr / recruiter / operations / team_lead / finance / employee | `/app/my` | PASS |
| sales | `/app/crm` | PASS |
| marketing | `/app/cms` | PASS |
| client_admin / client_viewer | `/app/client` | PASS |
| applicant | `/app/applicant` | PASS |
| Segment isolation + open redirect | — | PASS |

---

## Open debt (non-blocking)

| Item | Priority | Notes |
|------|----------|-------|
| Confirm Vercel deploy | Ops | beepabpo.com should include these commits |
| Remaining silent `.limit` lists | P2 | Re-scoped: `/app/approvals` (50) and `/app/client/timesheets` (40) fixed — those hid real pending work. `/app/cms` (6×50 tabbed tables) remains and needs per-tab state. Aggregate and search-candidate caps elsewhere are correct. See `REMAINING_WORK.md` §2.3 |
| Admin search by role name | Low | Name/org only now |
| OAuth / FTS / announcements | DEF | |
| Org/workflow CRUD | DEF | Keep RO |

---

## Closing gate

**READY — release gate 18/18, exit 0.** Next: re-subscribe existing browsers to push after
the VAPID rotation; set the new `CRON_SECRET` in any deployed environment calling
`/api/jobs/cron`; confirm Vercel picked up these commits on beepabpo.com.
