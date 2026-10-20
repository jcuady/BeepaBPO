# Completion ledger — Principal QA campaign

**Started:** 2026-09-13  
**Last updated:** 2026-10-20 (second pass — all **33** registered QA checks re-run, release gate **24/24**; the mark on the careers hero's uniform is composited from the brand file and gated; the radius metric measures what it claims to; the `/careers` filter button is no longer half a pixel under the touch minimum)  
**Campaign status:** **The release gate passes end to end.** Forward roadmap: `docs/REMAINING_WORK.md`.
Behavioural proof and the full per-feature breakdown: `docs/FEATURE_CHECKLIST.md`.

## Current verified state (2026-10-20)

Re-run on 2026-10-20. **Every row below is from a command that ran on that date.**
Anything not listed here is inherited from the table below and was not re-measured —
it is real, and it is not current.

| Gate | Result |
|---|---|
| `tsc --noEmit` | PASS — 0 errors (release-gate step 17) |
| `eslint .` | PASS — 0 errors (release-gate step 18) |
| `vitest run` | **997/997 across 107 files** (release-gate step 19) |
| `pnpm build` | PASS — compiled successfully (release-gate step 24) |
| **Release gate** | **24/24 steps passed, exit 0** — *"All checks passed. Ship it."* |
| **All 33 registered QA checks** | every one re-run on 2026-10-20 — see the table below |
| Brand icons | PASS — 13 assets re-derived from `logo-mark-raw.png`, compared byte for byte |
| OG share card | PASS — 1200×630, composed from the real logo and the tagline in `lib/site.ts` |
| **Careers hero** | PASS — the 4K hero and its 320×320 portrait re-derived from `beepa-logo-horizontal.png` and compared byte for byte. The mark on the uniform is **composited from the brand file, not generated**: an image generator asked for a branded polo returns marks that look like a logo and are not one. Its own release-gate step, so replacing the brand file cannot leave the hero wearing the old mark |
| Public careers | **17/17** over the rendered HTML |
| Contrast | PASS — 5,509 elements across 13 public + 44 app routes, 55 over-photo probes, **0 failures** |
| Typography | PASS — 53 routes, 4,183 body-copy elements, **0 wrong face** |
| Runtime radius | PASS — 12 public routes, 49/49 images loaded, **0 non-circular** |
| Design system | PASS — 0 raw primitives, 0 hardcoded colours; 1 arbitrary radius value / 3 uses, reported with the files named |
| SEO metadata | **ALL CHECKS PASS** |
| Page inventory | 96 pages, 9 handlers — `--check` clean |
| Dead controls | **0 candidates** across 271 `.tsx`, mutation-proven |
| Migrations | **39 on disk, 0 pending**, all applied. **Not a grammar check** |
| Responsive — public + auth | **120/120** across 15 routes × 8 viewports, exit 0, on a build proven current. The **first** run of the rebuilt `/careers` was **119/120** — the Filter button sat in a single 43.578px grid track, half a pixel under the 44px touch minimum, at iPad Mini only. The grid is now 6 tracks of 103.15px |
| Responsive — product app | **232/232** (224 route × viewport + 8 for `/app/cms`), 28 routes × 8 viewports |
| Role × page sweep | PASS — 13 roles, **0 console errors, 0 page errors** |
| Role → nav-reachable pages | **222/222** across 13 roles, exit 0 |
| Control census | **444 pages, 13 roles, 0 pages failed, 0 cold-start retries**; 518 distinct controls, 518 named, **0 without an accessible name**; **99%** pressable-control overlap (199 of 201) |
| Performance | PASS — within budget on every measured route |
| QA suite runner | 33 registered checks, each declaring the evidence file it must write. `--only=<ids>` runs a subset; an **unknown id is an error (exit 2)**, not a smaller selection. Mutation-proved |

### The 33 registered checks, re-run 2026-10-20

| Tier | Checks | Result |
|---|---|---|
| fast (13) | not-found, dialog-keyboard, command-palette, notification-bell, internal-links, public-careers, form-reset-defaults, suite-base-url, client-invite, auth-callback, runtime-radius, contrast, typography | **13/13 PASS** |
| slow (17) | responsive-app-1…4, responsive-app-cms, responsive-public, workflows, assertion-index, unlinked-employee, role-sweep, control-census, seo-metadata, role-pages, performance, payslip-exposure, attendance-tz, cron-smoke | **17/17 PASS** (responsive-public after the grid fix) |
| fast (2) | server-fresh, gate-coverage | **2/2 PASS** |
| gate (1) | gate — vitest + `tsc --noEmit` | **PASS** |

Two workflow exercises remain **BLOCKED** by the environment, not by the product:
`signup` and `admin-workflow`, both on the Supabase mail budget. They are reported as
BLOCKED and are not counted as passes. The full `--all` tier does not fit in one
invocation — it was cut off after 22 of 33 — so the slow tier was run with
`--only=<ids>`, which is what that flag was added for.

## Verified state (2026-10-15) — historical, before the 2026-10-20 re-measurement

Most of these **were** re-run on 2026-10-20 and their current figures are in the table
above; the ones that moved are marked SUPERSEDED. **Two were not re-run at all** and
remain inherited: **Playwright E2E** and **Responsive — all roles**. Those are the only
two figures in this document that are not current evidence, and they are marked here
rather than being quietly folded into "verified today".

| Gate | Result |
|---|---|---|
| `tsc --noEmit` | PASS — 0 errors |
| `eslint .` | PASS — 0 errors, 15 pre-existing `@next/next/no-img-element` warnings |
| `vitest run` | **680/680** across 90 files (was 504/504 across 84) — SUPERSEDED: 997/997 across 107 files |
| `pnpm build` | PASS |
| Route RBAC | **75/79** + 4 structural exemptions, exit 0 — re-run 2026-10-20, unchanged |
| Action RBAC | **64/65**, exit 0 (the 1 is a public form, annotated) — re-run 2026-10-20, unchanged |
| Dead controls | **0 candidates** across 269 `.tsx`, mutation-proven — re-run 2026-10-20 across 271 `.tsx`, still 0 |
| Form reset integrity | **28 forms scanned, 21 that reset — 0 with a field that survives one** — re-run 2026-10-20, unchanged |
| Migration preflight | **38 on disk, 0 pending**, all applied, Local == Remote for every one. **Not a grammar check** — SUPERSEDED: 39 on disk |
| Workflow suite | **21 exercises, 490 assertions, 20 PASS / 1 BLOCKED / 0 FAIL** against a production build on real DB state, with the build proven current by `audit:server-fresh`. Signup cleared after ~14h and now passes for real (6 assertions); the one remaining BLOCKED path is the admin-invite **success** leg (SMTP quota) — SUPERSEDED: 493 assertions, 19 PASS / 2 BLOCKED (signup and admin-workflow, both on the mail budget) |
| Button surface | 13 roles / 444 page visits, **1 page failure**; 199 pressable controls, **99.0%** label overlap, **0 without an accessible name** (118 form fields counted and published separately — the primary metric used to include them). Every unmatched *button* chased: 3 flagged over the series, **1 real hole** (cash-advance `Reject`, never pressed — reject leg had zero executions) now covered; 2 artefacts (`Save`, `Continue`, both exercised and working) — re-run 2026-10-20 with **0 page failures** and **0 cold-start retries** |
| Role × page reachability | **479** role-page visits across 13 roles, **0 page errors** — re-run 2026-10-20: role sweep 13 roles / 0 page errors, and `role-pages` **222/222** |
| Responsive — public + auth | **120/120** across 15 routes × 8 viewports, exit 0, on a build proven current — measured *after* the two homepage fixes it previously hid. Re-run 2026-10-20: **120/120**, after the `/careers` filter-grid fix |
| Playwright E2E | **102 passed, 2 skipped, 0 failed** in 3.3 min against the build current at the time (replaces the inherited "100 passed, 4 skipped") — **NOT re-run on 2026-10-20. Inherited.** |
| Responsive — owner, product app | **232/232** (224 route × viewport + 8 for `/app/cms`), 28 routes × 8 viewports, re-run on a build proven current — re-run 2026-10-20, unchanged |
| Responsive — all roles | **178/178** across 7 roles × 390 + 768, all exit 0, build proven current — replaces the inherited "100/100" (2026-10-09), which had no runner behind it. Each role is measured only over the routes it can open; the rest are listed per role under `inaccessible` — **NOT re-run on 2026-10-20. Inherited.** |
| Responsive — marketing | 56/56 across 7 routes × 8 viewports — SUPERSEDED: the public sweep now covers 15 routes × 8 viewports and measures **120/120** |
| Design system | **exit 0 — 0 raw primitives, 0 hardcoded colours** — re-run 2026-10-20, plus 1 arbitrary radius value / 3 uses now counted and named |
| Filter persistence | exit 0 — 32 paginated pages, 0 dropped filters, 0 unverified — re-run 2026-10-20 (ship gate step 12), 33 paginated pages |
| Realtime delivery | PASS — an authenticated subscriber received a live `notifications` INSERT — re-run 2026-10-20 (ship gate step 22) |
| Payroll periods | 0 overlapping; overlap constraint and status-coherence trigger both installed — re-run 2026-10-20 (ship gate steps 15–16) |

### Corrections made to this ledger's own gates (2026-10-15)

Four of the gates above had been reporting findings that were not real, and one
had a **test asserting the wrong answer**. Each printed a number in the same
format as a measured one, which is how a stale gate survives:

| Gate | Was | Now |
|---|---|---|
| Migration preflight | printed "pending: 4" from a hardcoded list, months after all four were applied | prints no pending count at all; points at `supabase migration list` |
| Dead controls | 2 "buttons with no handler", both JSDoc prose about a button | reads comment-stripped source; mutation-proven it still catches a real one |
| Route RBAC | flagged `/app/[...rest]`, which is `notFound()` and nothing else | exempt, with the reasoning recorded inline |
| Action RBAC | flagged the public career enquiry dialog | one-line `// unauthenticated:` marker, as its sibling already had |

`tests/migration-preflight.test.ts` asserted `toContain("pending: 4")`. That test
was guarding the lie. It now asserts the opposite property: the script must never
print a pending count.

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
| 5 | Automated gates green | **PASS** — typecheck · lint · vitest **745 / 96 files** · build · Playwright 102/2/0 · release gate **21/21, exit 0** |
| 6 | PROJECT_STATUS honest | **PASS** — blockers marked BLOCKED while open, and rewritten to CLOSED with the evidence once resolved |

**Overall:** **READY.** The release gate passes **21/21 with exit 0** (three steps added this
session: migration preflight, touch targets, page data shape), and both former blockers
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
| Role × page | `audit-role-pages.mjs` — **222/222** nav-reachable pages clean across 13 roles, reading the rendered sidebar. This row previously read "219/219, re-run 2026-10-09" and was stale: the route set grew after that run and nothing had re-measured it, because **the script wrote no evidence file at all** — its result lived only in terminal scrollback, which is how the matrix and this ledger drifted to different numbers for the same check |
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

**READY — release gate 21/21, exit 0.** Next: re-subscribe existing browsers to push after
the VAPID rotation; set the new `CRON_SECRET` in any deployed environment calling
`/api/jobs/cron`; confirm Vercel picked up these commits on beepabpo.com.
