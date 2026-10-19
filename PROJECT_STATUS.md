# PROJECT_STATUS — Beepa / BeepoBeepa

**Updated:** 2026-10-19 · **Branch:** `main`
> No HEAD SHA is pinned here on purpose: a doc committed in commit X cannot name X, so the pin is always stale by the next commit. Live state is `node scripts/verify-all.mjs`; the numbers below are the ones that command prints.
> **What the 2026-10-19 pass re-ran:** the ship gate, the fast QA tier, the contrast, SEO-metadata, public-careers and server-fresh gates, and the auth workflow exercise. The role sweep, the responsive sweeps and the Playwright figures are **from their own last runs and were not re-verified by that pass** — they are not stale because they are wrong, and they are not fresh either.
**Overall:** **Shippable.** The 23-step gate passes end to end: *"All checks passed. Ship it."* exit 0. Zero pending migrations, zero overlapping payroll periods, realtime delivery confirmed end to end. Forward roadmap: `docs/REMAINING_WORK.md`.

> Supersedes the 2026-09-14 "READY" claim, which asserted gates that were not being enforced. Evidence in `docs/SYSTEM_AUDIT.md`.

---

## Health

| Gate | State | Evidence |
|---|---|---|
| TypeScript | **PASS** | `tsc --noEmit` exit 0 |
| Lint | **PASS** | `eslint . --max-warnings=0` exit 0 |
| Unit tests | **PASS** | **991/991 across 106 files** (re-measured 2026-10-19) |
| Production build | **PASS** | `next build` exit 0 |
| E2E (Playwright) | **PASS** | **100 passed, 4 skipped, 0 failed** — prod build, cold `.auth`, 59.5s |
| Ship gate | **PASS** | `verify-all.mjs` → **23/23 passed. "All checks passed. Ship it."** exit 0 (2026-10-19) |
| **Brand icons** | **PASS** | `generate-brand-icons.mjs --check` — 13 favicon / PWA / Google-Organization assets re-derived from `public/brand/logo-mark-raw.png` and compared byte for byte. `app/icon.png` is Next's file-convention icon and overrides the `icons` array in `app/layout.tsx`, so it is the file a browser tab actually shows. `public/apple-icon.png` was a **404 on every page** and did not exist until this pass |
| **OG share card** | **PASS** | `generate-og-image.mjs --check` — 1200x630 composed from the hero photo, the real horizontal logo and the tagline read out of `lib/site.ts`. It had declared 1672x941 while the file was 1200x630, so every social share cropped the logo off |
| **Public careers** | **PASS** | `qa-exercise-public-careers.mjs` — **16/16** over the rendered HTML: search, three filters, filter chips, clear-all, both empty states, the canonical, and the account CTA return path. Filters are built from anon-readable `job_posts`; `departments` is `to authenticated` (internal HR) and returns 0 rows to the anon key |
| **Role × page sweep** | **PASS** | `audit-role-sweep.mjs` — every nav-reachable page for all 13 roles, plus 10 marketing pages: **0 console errors, 0 page errors, 0 error states**. Download endpoints recorded separately (they are not navigable by design) |
| **Data population** | **PASS** | `audit-data-population.mjs` — every table the app queries, distinguishing **missing** from **empty** (a `head:true` count returns `null` for a nonexistent table *or* a nonexistent column, with no error). **996 rows** across app tables |
| **Live workflow exercises** | **PASS** | `qa-exercise-leave-workflow.mjs` — employee → team lead → HR, asserting against the database rather than the DOM: **13/13**. `qa-exercise-ticket-workflow.mjs` — client admin → assignee: **10/10**. `qa-exercise-admin-workflow.mjs` — cron, test push, role change, revoke: **18/18** (1 path BLOCKED by Supabase email rate limiting). `qa-exercise-hire-workflow.mjs` — stage → offer → hire: **18/18**. `qa-exercise-crm-workflow.mjs` — lead → deal → proposal → won → client org: **21/21**. `qa-exercise-payroll-workflow.mjs` — salary → run → recalc → 2-step approval → finalized: **19/19**. All restore what they change and assert the restoration |
| **Admin role integrity** | **PASS** | `tests/admin-role-assignment.test.ts` — 12 cases. Changing a role used to delete every role a person held, silently stripping the `employee` self-service baseline (8 permissions: leave, payroll, attendance, tickets, approvals, cash advance, NTE, performance). Inviting staff granted no baseline at all. Both fixed; guard is mutation-proved |
| **Action coverage** | **PARTIAL** | **83** exported server actions across 21 modules, counted by `qa-action-inventory.mjs`. **76 exercised end to end** against the database (leave 3, admin 5, CRM 8, payroll 5, auth 8, attendance 8, CMS 14, recruitment 7, NTE 3, notifications 3, employee/profile/contact 3, billing 2, cash advance 2, documents 3, ticket 2); the rest render (471 page visits, 0 console errors) and are unit-covered, but have not been driven through the UI. Per-domain breakdown in `docs/QA_REPORT.md` §5 |
| **Notification integrity** | **PASS** | `qa-verify-notifications.mjs` — 58 rows, **58 distinct bodies**, 0 legacy generic strings, **0 dead links**. The 27 orphaned rows carrying the old body were deleted via `cleanup-orphan-notifications.mjs` and reseeded from live records |
| **Page headings** | **PASS** | `page-heading-contract.test.ts` — 79 `<PageHeader>` call sites across `app/` **and** `lib/`; **76 now carry a `title`**, 2 are documented exceptions. Before the fix, 78 of 79 rendered the greeting `Good morning, Demo.` — byte-identical, because every seeded profile is named "Demo" |
| Authorization (routes) | **PASS** | `audit-rbac.mjs` **75/78 (96%)** + 3 structural exemptions, exit 0 |
| Authorization (actions) | **PASS** | `audit-action-rbac.mjs` **63/64**, exit 0 |
| Page wiring | **PASS** | `audit-page-wiring.mjs` scanned 269 `.tsx`, **0 candidates** (validated by negative control) |
| Page inventory | **PASS** | 93 pages; `--check` clean |
| **Design system** | **PASS** | `audit-design-system.mjs` exit 0 — **0 raw `<select>`/`<table>`/`<input>`/`<textarea>`/`<button>` outside `components/ui/`, 0 hardcoded colours**; 12 arbitrary radius values / 106 uses reported as informational |
| **Filter persistence** | **PASS** | `audit-filter-persistence.mjs` exit 0 — **32 paginated pages, 0 dropped filters, 0 unverified**; 13-case contract test with negative controls for all three of the auditor's own false positives |
| **Touch-target overrides** | **PASS** | `audit-touch-overrides.mjs` — **0 compact-variant defects** (5 fixed); 87 load-bearing sites explicitly do-not-touch; the remaining 96 are a design call, not a bug |
| Role × page reachability | **PASS** | `audit-role-pages.mjs` nav-driven crawl, all 13 roles, **219 nav-reachable pages clean** — re-run 2026-10-09 in two batches after the shared-chrome changes (`app-header`, `site-header`, `notification-bell`), which appear on nearly every page |
| Responsive — all roles | **PASS** | 100/100 at 390 + 768 (owner 14, finance 14, team lead 14, employee 14, client admin 20, client viewer 18, applicant 6) |
| Responsive — `/app/*` (owner) | **PASS** | **224/224** combinations across 28 routes × 8 viewports (375→1920). **0** touch-target, overflow, console, bleeder or sub-16px-text failures. Went 215/232 → 224/224 this session |
| Responsive — marketing | **PASS** | 56/56 across 7 routes × 8 viewports |
| Performance | **PASS** | 7/7 measured, 0 over budget, **CLS 0.000 on every route**; worst LCP `/app/my` 984ms. Always measured against `next build && next start` |
| A11y | **PASS** | **14/14** axe checks (WCAG 2 A/AA, serious + critical) + switch keyboard + 44px touch + a positive "card titles are exposed as headings" check. **The switch touch-target check now actually exercises the coarse-pointer path** — it previously set `hasTouch` alone, which leaves `pointer` fine, so it measured 24×30 against a 44px rule and could not have passed |
| Service worker cache policy | **PASS** | 9/9 sandbox tests; authenticated HTML never cached or precached |
| E2E | **PASS locally** | employee 13/13, owner 7/7, client 13/13, anonymous 62 (3 skipped by design); a11y now 13/13. **Not yet running in CI** — the job is now runnable (build + prod server + health check + self-cleanup) and only needs `RUN_E2E=true` plus the secrets; see `docs/REMAINING_WORK.md` §2.4 |
| Notification isolation | **PASS** | 0 third-party leaks |
| Attendance timezone | **PASS** | write + read paths resolved against `employees.default_timezone`; verified on a `TZ=UTC` host |
| Attendance corrections | **PASS** | correction request → review → corrected-times path |
| Applicant careers | **PASS** | `/app/applicant/jobs` + `/app/applicant/jobs/[id]`, in-app apply, notifications reachable from nav |
| Application stage statuses | **PASS** | all 12 stages: label, tone, applicant note, staff note, terminal flag, pipeline step |
| **HR careers access** | **PASS** | `20261008120000` applied; `audit-rbac.mjs` reports `recruitment 5/5` — the former live 403 on `/app/recruitment` is gone |
| **Realtime notifications** | **PASS** | `20261006140000` applied (Local == Remote); a notification event was received end to end by an authenticated subscriber |
| **Payroll period overlap** | **PASS** | 0 overlapping periods; the `stub_v1` fiction was retired and the window rebuilt from the engine |
| **Payroll approval gating** | **PASS** | ₱0 exposed before approval; the `20261007130000` trigger now enforces the same rule in the database |
| **Lead attribution RLS** | **PASS** | the permissive `WITH CHECK (true)` policy is gone; authenticated insert now `42501`, service-role insert still succeeds |
| **Push delivery** | **NOT VERIFIED** | headless FCM endpoint is a phantom; needs a real device (`docs/PUSH_NOTIFICATIONS.md`) |

---

## Release gate — `node scripts/verify-all.mjs`

```
23/23 steps passed

All checks passed. Ship it.
```

**exit 0.** This transcript supersedes the earlier `15/18 … 2 step(s) failed … Do not ship.`
output, which was correct at the time and is kept below as history only.

The gate used to print `All checks passed. Ship it.` in the same run that reported
the double payment and the unapproved payroll, because both payroll audits only
warned and a skipped realtime step still counted as a pass. It was also
arithmetically dishonest: failures were derived as `total − passed`, so every skip
was double-counted as a failure (13 + 3 + 1 = 17 "failures" out of 16 steps).

| Step | Result |
|---|---|
| 1 Node · 2 VAPID present · 3 VAPID accepted · 4 route RBAC · 5 action RBAC · 6 page wiring · 7 page inventory | PASS |
| **8 Brand icons derived from the logo mark** | **PASS** — 13 assets re-derived from `logo-mark-raw.png` and compared byte for byte; no drift |
| **9 OG image matches the declared brand** | **PASS** — 1200x630, composed from the real logo and the tagline in `lib/site.ts` |
| **10 Design system consistency** | **PASS** — 0 raw primitives, 0 hardcoded colours |
| **11 Filters survive pagination** | **PASS** — 33 paginated pages, 0 dropped filters, 0 unverified |
| 12 Touch targets meet 44px · 13 every app page declares its data shape | PASS |
| **14 Payroll periods do not overlap** | **PASS** — stub period retired; 0 overlapping pairs |
| 15 Payroll period/record status coherent | **PASS** — ₱0 exposed before approval |
| 16 TypeScript clean · 17 Lint clean | PASS |
| **18 Vitest (full suite)** | **PASS** — **991/991 across 106 files** |
| 19 Migration structural preflight | PASS — 38 migrations preflighted |
| 20 Live data smoke (DB state) | PASS |
| 21 Realtime event delivery | **PASS** — event received end to end |
| 22 DB row counts (target) | PASS |
| **23 Production build** | **PASS** — `next build` compiled successfully |

## The gate is 18/18 — "All checks passed. Ship it." (2026-10-09)

Both remaining failures are closed, and neither closed the way the notes above
expected.

**Step 10 was closed by retiring fiction, not by choosing a number.** The draft
`September 2026 payroll` period (2026-09-01..09-30) fully contained the finalized
fortnight, so the same days sat in two runs. Every one of its 10 records read
`engine=stub_v1`, `worked_minutes: 4800` across a 30-day window, with zero
statutory deductions and `net_pay` equal to `gross_pay`. It was not a second
payroll result to reconcile, so there was no figure to choose between.
`scripts/reconcile-payroll-period-overlap.mjs` (`pnpm fix:payroll-overlap`)
retired it: 1 period, 10 records, 30 components, 10 payslips, **0 rows** on the
`ON DELETE SET NULL` legs. It refuses any period that is `finalized`/`disbursed`/
`closed`, and refuses unless *every* record is `stub_v1`.

The pipeline was then repopulated by the engine rather than by seed data:
`scripts/seed-payroll-window.mjs` created `September 16–30, 2026` with 10 draft
records and ₱240,000 gross, using `lib/payroll/schedule.ts`'s own
`salaryFactorFor` / `fixedPayAmount`. `tests/payroll-seed-window.test.ts`
evaluates that restated math against the engine so the copy cannot drift.

**Step 16 was never broken realtime — it was a probe that could not pass.** It
subscribed with the **anon** key while `notifications` RLS is
`user_id = auth.uid()` scoped to `authenticated`, so it waited for an event anon
could never receive. The publication already listed all 12 tables. The probe now
signs in as the notification's owner and refuses to run if that user is not the
row owner; the event arrives.

**…and the probe still could not tell "late" from "never".** It polled to a flat
15s deadline and, on expiry, printed `DELIVERY_FAILED` and failed step 16 — whether
the event was never coming or merely arriving late. Running inside the gate, straight
after a full vitest suite and the DB row counts, one run produced exactly that red on a
system that delivered the same event in **267–496ms** when the probe was run on its own.
The probe now keeps polling to a 60s ceiling and reports the **measured latency**, and
`LATE` is its own outcome with its own exit code — a delivery-latency regression is
never reported as an outage, and is never folded into the pass count either.

**Applying the 7 pending migrations required two fixes first**, and an 8th
(`20261009120000_lead_attribution_insert_policy.sql`) followed from the database
advisor pass. One trigger function omitted `returns trigger` (`42P13`), and the CLI
then rejected the canonical clause order — `RETURNS` must precede `LANGUAGE` — which
was bisected against the live database rather than guessed at.
`tests/migration-function-clauses.test.ts` pins both. `supabase migration list` now
reports zero pending.

**The gate went 13/18 → 15/18 → 16/18 on 2026-10-09.** Step 15 (live data smoke) had been
failing on an empty `leave_requests` table, which `scripts/seed-demo-leave.mjs` repopulated
(17 rows) — the fix exposed that the `leave_requests >= 1` assertion had never been
validating seeded data, only another test's side effect. Step 11 then cleared:
`scripts/fix-premature-finalization.mjs` returned 10 finalized records to draft, so the
₱500,000 is no longer payable inside an unapproved period. That mattered beyond the gate —
migration `20261007130000_payroll_record_status_coherence.sql` installs a trigger that
*rejects* a finalized record under an unapproved period, so leaving the rows as-is would
have left the database permanently out of step with its own rule.

Both of the failures that remained mid-session are now closed: **10** was closed by
retiring the `stub_v1` seed period, because it was never a second payroll result to
reconcile, and **16** was closed by fixing a probe that could not have passed rather
than by adding anything to the database. See the 18/18 section above.

**The realtime migration was carrying two defects of its own — now removed.** It created
`notify_ticket_created` and `notify_leave_request` as table triggers, while the application
already notifies in `lib/tickets/actions.ts:91` and `lib/leave/actions.ts:129`. Applying it
would have given every new ticket **two** notifications for the same person, and told an
employee that *they* had "a new leave request pending review" for leave they submitted
themselves. Both functions are removed (the file was never applied, so nothing had to be
unwound) and `tests/notification-single-path.test.ts` asserts the trigger stays absent *and*
the application-side call stays present. The realtime publication and `profiles.last_login_at`
sync — what the migration actually exists for — are untouched.

Failures are now **named** in the summary, skips are tracked separately, and
`passed + failed + skipped === total` is asserted (exit 2 on mismatch).

---

## What is still open, and on whom

Nothing here blocks a release; the gate passes. Full detail in
**`docs/REMAINING_WORK.md`**.

1. **Push delivery** — needs a real device; the headless FCM endpoint is a phantom
   (`docs/PUSH_NOTIFICATIONS.md`). **Also:** the VAPID keypair was rotated when
   `.env.local` was truncated, so existing browser subscriptions must re-subscribe.
2. **Deployed `CRON_SECRET`** — regenerated locally after the same incident. Any
   deployed environment calling `/api/jobs/cron` must be set to the new value;
   locally nothing is exposed either way, since `authorizeCronRequest` fails closed.
3. **E2E in CI** — the job is runnable and needs only `RUN_E2E=true` plus secrets.
4. **Is `ulrjitekiylgepdyijsw` staging?** — determines which dev affordances may be
   enabled there.

---

## Known issues carried forward

**`min-h-11` overrides (P2).** 242 occurrences across 119 files re-assert a floor the
primitives already apply; the ones on `Button` can defeat a compact variant. Needs
per-site visual review, so it was documented rather than mass-edited.

**Arbitrary radii (P2).** 12 distinct `rounded-[Npx]` values, 106 uses, 8 off-scale.
Reported as informational by the design audit on purpose — a 106-site sweep cannot be
reviewed in one pass.

**Un-paginated lists (P2).** 27 pages now use `ListPager`, including every queue where
the cap hid real work: `/app/approvals` (50 pending approvals),
`/app/client/timesheets` (40 pending review days), and `/app/cms` (six lists at 50
each — blog posts, services, FAQs, industries, testimonials, case studies).
`ListPager` grew an optional `param` prop because `/app/cms` stacks six independent
lists on one page rather than tabbing them. Aggregate and search-candidate
`.limit()`s elsewhere are correct as-is; `docs/REMAINING_WORK.md` §2.3 splits
fixed / legitimate / open.

**E2E no longer leaves data behind (2026-10-09).** This note previously said to run
`node scripts/cleanup-leave-duplicates.mjs --apply` after the E2E job, because
`e2e/mutations.spec.ts` created a duplicate bereavement leave row per run. That pollution
is fixed at the source: the spec now picks a benign leave type by name instead of
`selectOption({ index: 1 })` (which landed on BEREAVEMENT via seed ordering), and removes
the row it created. **Cleanup is scoped by row ID**, snapshotting IDs before submit and
deleting only what did not exist before — the first attempt matched on the `reason` string
and emptied `leave_requests`, because every row in the table carried that reason.

Consequence: `leave_requests` is now empty, so `tests/live-data-smoke.test.ts` asserts
`count("leave_requests") >= 1` and **fails by design**. No seed script ever creates that
table, so the assertion was passing on e2e residue rather than on seeded data. Decision and
options: `docs/REMAINING_WORK.md` §1.5. **Unit tests: 504/504 across 84 files** — the
`leave_requests` table has since been repopulated by `scripts/seed-demo-leave.mjs`, so this
assertion is now backed by real demo data.

**A bare `signOut()` was global, not local (2026-10-09).** `supabase.auth.signOut()`
defaults to `scope: "global"` — confirmed in the installed `@supabase/auth-js@2.115.0` —
so the employee portal's "wrong portal, wrong user type" rejection was revoking the
client's *working* session on every device, and the app header's Sign out button did the
same. Five call sites now pass `scope` explicitly; `tests/auth-signout-scope.test.ts`
blocks a regression and keeps a global sign-out available. Details: `docs/CHANGELOG.md`.

**Two auth security defects found by driving the UI (2026-10-10).** Both were live
buttons, not theoretical.

- **CWE-620, unverified password change.** `changePasswordAction` validated only the
  new password and called `supabase.auth.updateUser({ password })`. supabase-js treats
  a live session as sufficient authority to rotate a credential, so anyone holding a
  borrowed or hijacked session could reset the password and lock the owner out
  permanently — and the form had no current-password field to check. It now
  re-authenticates with `signInWithPassword` and returns before `updateUser` on
  failure, with one message for every cause so it cannot be used as an
  account-status oracle.
- **`logoutAllAction` was dead code.** It is the only path that revokes refresh tokens
  on other devices, and nothing in the UI referenced it — so a user who suspected a
  compromised session had no way to revoke it. The existing guard had asserted the
  function *exists*, which is why this survived. "Sign out everywhere" is now in the
  account menu, and `tests/auth-reauth-and-global-signout.test.ts` asserts it is
  *reachable* from a component. Also fixed: signup reported a Supabase 429 rate limit
  as "Unable to create account with that email", sending a prospective client to retype
  a perfectly good address. `qa-exercise-auth-workflow.mjs`, 35/35.

**An approved attendance correction stored times 8 hours out (2026-10-10).**
`lib/attendance/zoned-time.ts` exists precisely because manual entry used to store
timestamps 8 hours out of step with clocked ones, and `upsertAttendanceRecord` was
converted to use it. The correction path never was: `resolveCorrectedClockTimes` is
pure string arithmetic and the value it receives is a naive `datetime-local` string
that Postgres casts as UTC. Measured on the demo tenant, an employee asked to
correct their shift to 08:00–17:00 Manila and the row was written as `08:00Z` /
`17:00Z`, which display as **4:00 PM and 1:00 AM**. `worked_minutes` still came out
at 540 because both endpoints shifted together, so payroll hours looked right while
every displayed time and every wall-clock-anchored rule was wrong. Fixed by
resolving the requested values through the employee's `default_timezone` first.
`qa-exercise-attendance-workflow.mjs`, 31/31.

**CMS: all 14 actions driven, no defect (2026-10-10).** `qa-exercise-cms-workflow.mjs`,
42/42 — create, edit, publish and archive for all six content types, plus the About
page, each removed again afterwards. Two structural facts established rather than
assumed: there is **no delete action anywhere in `lib/cms/actions.ts`** (content can
be created, edited, published and archived, never removed — Archive may be the
intended soft delete, so this is documented, not changed), and `cms.manage` is held
by **exactly one role, `marketing`** — not `owner`, not `super_admin`, not `hr`,
which extends the `super_admin` finding below.

**Documents: all 3 actions driven, and every seeded document was dead (2026-10-11).**
`qa-exercise-documents-workflow.mjs`, 31/31 — the module itself is the best-written in
the codebase (checks its errors, rolls back the storage object when the metadata write
fails, validates MIME and size, derives visibility from permission). No product defect.

What the run found is that all 8 seeded rows were undownloadable, so the documents page
rendered a full, plausible list in which every Download failed. Three faults stacked:

1. `scripts/seed-qa-fixtures.mjs:451` hardcoded `storage_bucket: "documents"` — a bucket
   that does not exist and that no product code writes to. Metadata only, no bytes, and
   the script reported the fixtures as seeded.
2. No bytes had ever been uploaded for any of them, so repointing the bucket alone would
   still have left 8 dead rows.
3. The paths could not have worked even with a bucket: the storage RLS casts the first
   path segment to uuid, and the seeded paths began with a literal `demo/`, so Postgres
   raised `invalid input syntax for type uuid: "demo"` — to the user.

Fixed at the source (`seed-qa-fixtures.mjs` now targets `employee-documents`), repaired in
place (`qa-repoint-document-bucket.mjs`, `qa-repair-document-paths.mjs`) and the bytes
written (`qa-seed-document-blobs.mjs`, `pnpm seed:demo:documents`). 8/8 rows now serve
bytes, verified through the UI by downloading a **pre-existing** document — 704 bytes of
real PDF — because "the file I just uploaded downloads" says nothing about the seven that
were already broken.

**The policy itself is still wrong and is documented, not changed:** a hard `::uuid` cast
makes a malformed path *raise* instead of *deny*, turning an unlucky path into a database
type error shown to the user, for every user who touches the bucket. Widening a predicate
is a security decision, so it is flagged instead of taken.

**NTE: three actions driven, and two of them were broken (2026-10-10).**
`qa-exercise-nte-workflow.mjs`, 24/24 — HR issues, the named employee answers, HR
resolves with a disciplinary outcome. Two real defects:

- **P0.** `submitNteResponse` inserted the response, then updated the case status —
  but `nte_cases` UPDATE is gated on `nte.manage` and an employee holds `nte.self`,
  so RLS rejected it. The error was never read, and the action returned "Response
  submitted." anyway: the text was stored, the case stayed `issued`, and the employee
  was told it had been filed. The tempting fix — an `for update` policy on
  `is_self_employee(employee_id)` — would let an employee set `resolution_type` and
  `resolved_at` on their own Notice to Explain, because RLS cannot restrict columns.
  Instead `20261010120000` moves both halves into one narrow SECURITY DEFINER
  function that resolves ownership from `auth.uid()` and **cannot resolve a case**.
  Applied; the employee keeps no direct UPDATE on `nte_cases`.
- **P1.** `createNteCase` stored `response_due_at` raw from a `datetime-local` input
  (the attendance-correction bug, one module over). HR set 17:00 on 9 March; the
  employee saw "Due Mar 10, 2026", because the render happens in UTC+8. Fixed on
  both halves — `naiveDateTimeToZoned` on write, a new `formatZonedDate` on read.
  I had reasoned from the code that this was latent and harmless, because the page
  renders the date only; measuring what the employee actually sees is what caught it.
- **P2.** The `/app/hr/nte` search box read `q`, echoed it back and passed it to the
  pager, but never applied it to the query. "Page wiring (no dead controls)" passed
  throughout — that audit sees a control that renders and submits, not one that is
  ignored afterwards.

The stale-tab race is now watched refusing rather than assumed: the resolve form only
renders while a case is open, so the guard inside `resolveNteCase` is unreachable by
clicking twice. The exercise opens a second HR tab first and submits the stale form.

**Recruitment: the five remaining actions driven, no defect (2026-10-10).**
`qa-exercise-recruitment-workflow.mjs`, 23/23 — createJobPost, updateJobPost,
publishJobPost, closeJobPost, submitJobApplication. All 7 actions in
`lib/recruitment` are now covered. A closed role is not offered to applicants and can
be re-published; closing preserves the original `published_at`. Worth noting:
`submitJobApplication` does not create a fresh applicant — it looks the caller up by
`profile_id` and **updates** that row, so applying rewrites a real demo record. The
exercise snapshots and restores it field for field.

**E2E: 100 passed, 4 skipped, 0 failed** against a production build on port 3100, from a
cold `.auth`. Reaching that required fixing four separate harness faults that each presented
as a product bug — the `signOut` scope bug above, `waitForURL()` hanging on `load`,
`locator.fill()` losing values to a pre-hydration React re-render, and the suite exhausting
Supabase's per-IP password-grant rate limit and having the 429 reported to the test as
"Invalid email or password." All three remaining fixes are guarded by contract tests, and
the run got ~45% faster (1.1m → 59.5s) once a11y and viewport stopped spending16
password grants re-acquiring a session that already existed.

**`tests/nav-active.test.ts` flake (fixed).** It used to assert wall-clock time on a
pure string function, which measured the machine rather than the code. It now
compares a 20-item against a 4,000-item nav: contention inflates both samples and
cancels, an accidental O(n²) inflates only the larger one. Linear ≈ 200x, quadratic
≈ 40,000x, assertion at 400x.

---

## Tooling

Supabase project `nwvnawgxkzwiercllgmg` is canonical and the supplied credentials are
correct — **no rotation required**. Credentials are referenced by environment-variable
name only and are never written into tracked files.

`@playwright/mcp@0.0.83` is installed as a devDependency, but its MCP tools have not
become callable in the agent tool surface. Committed browser tests therefore run
through the local Playwright CLI (1.62.1). A `pnpm-workspace.yaml` override pins the
Playwright tree to 1.621 because `@playwright/mcp` otherwise installs a conflicting
alpha.