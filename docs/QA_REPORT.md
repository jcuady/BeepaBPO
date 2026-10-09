# QA REPORT — BeepoBeepa

**Date:** 2026-10-10 · **Role:** Principal Full-Stack Engineer + QA Engineer
**Branch:** `fix/auth-signout-scope-and-payroll-coherence` · **Target:** production build on `:3100`
**Supabase:** `nwvnawgxkzwiercllgmg`

This pass answers a question the existing audits did not ask. `audit-role-pages.mjs`
asks *can this role reach the page?* The release gate asks *does it compile, lint and
typecheck?* Neither asks **does the page work once you are there, and does it show a
user anything real?**

---

## 1. What was run

| Check | Tool | Scope |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | whole repo — **exit 0** |
| Lint | `npx eslint . --max-warnings=0` | whole repo — **exit 0** |
| Unit/contract | `npx vitest run` | **525 passed, 86 files** |
| Production build | `npx next build` | **exit 0** |
| Release gate | `node scripts/verify-all.mjs` | **18/18 — "All checks passed. Ship it." — exit 0** |
| **Per-role page sweep** | `scripts/audit/audit-role-sweep.mjs` | **13 roles × nav-reachable pages + 10 marketing pages = 471 visits** |
| **Data population** | `scripts/audit/audit-data-population.mjs` | **every table the app queries** |
| **Live workflow exercise** | `qa-exercise-leave-workflow.mjs` | **employee → team lead → HR, 12 assertions** |
| **Ticket workflow exercise** | `qa-exercise-ticket-workflow.mjs` | **client admin → operations, 9 assertions** |
| Interactive | Playwright MCP | login, headings, live workflow |

### Heading spot-check (Playwright MCP, owner, production build)

Every one of these previously read `Good morning, Demo.`:

```
/app/dashboard      Overview          /app/clients         Clients
/app/payroll        Payroll           /app/reports         Reports
/app/hr             HR                /app/admin           Admin
/app/recruitment    Recruitment       /app/tickets         Tickets
/app/crm            CRM               /app/crm/leads      CRM Leads
/app/payroll/periods  Payroll Periods /app/attendance      Attendance
/app/leave          Leave Approvals   /app/employees       Employees
```

**14 sampled pages, 0 greetings remaining.**

### Per-role matrix — 471 role-page visits, after seeding

| Role | Pages | OK | Redirected | Empty | Downloads † | Console noise |
|---|---|---|---|---|---|---|
| owner | 60 | 58 | 2 | 0 | 0 | 0 |
| superadmin | 37 | 34 | 2 | 0 | 1 | 0 |
| hr | 52 | 49 | 2 | 0 | 1 | 0 |
| recruiter | 33 | 31 | 2 | 0 | 0 | 0 |
| sales | 47 | 44 | 2 | 1 | 0 | 0 |
| marketing | 49 | 46 | 2 | 1 | 0 | 0 |
| operations | 36 | 33 | 2 | 0 | 1 | 0 |
| teamlead | 21 | 19 | 2 | 0 | 0 | 0 |
| finance | 34 | 31 | 2 | 0 | 1 | 0 |
| employee | 17 | 14 | 2 | 0 | 1 | 0 |
| clientadmin | 36 | 33 | 3 | 0 | 0 | 0 |
| clientviewer | 36 | 35 | 1 | 0 | 0 | 0 |
| applicant | 13 | 11 | 2 | 0 | 0 | 0 |
| marketing (anon) | 10 | 10 | — | 0 | 0 | 0 |

† **not defects.** Every one is a download endpoint (`/app/reports/export`,
`/app/my/payroll/[id]/payslip`). Playwright cannot navigate to a response that starts
a file download; the route working *is* the download. The sweep records them
separately rather than as failures.

The two "Empty" entries are both `/app/crm/leads/1784e8ab-…` — one of the four
pre-existing leads, which has no activity history. That is a correct empty state for
that record, not a defect. The seeded deals carry populated timelines.

**Result: 471 role-page visits, 0 console errors, 0 uncaught page errors, 0 pages
rendering an error state, 0 marketing problems.**

---

## 2. Findings

### P0 — Every page's `<h1>` was a greeting. Fixed.

`PageHeader` renders `{greeting}, {first_name}.` unless given a `title` prop.
Measured against `a73f55a`, the commit before the fix: **79 call sites existed,
and only 1 carried a `title`** — the single one `SYSTEM_AUDIT.md` §16.5 fixed in
August. The other **78 rendered the greeting**. Because every seeded demo
profile has `first_name = "Demo"`, 78 of them read, byte for byte:

> **Good morning, Demo.**

That includes `/app/payroll/periods`, `/app/crm/leads/[id]`, `/app/tickets/[id]`,
`/app/admin/users` — every record and queue in the product. `SYSTEM_AUDIT.md` §16.5
found this on the job detail page in August, added the `title` prop, fixed that one
caller, and noted "every existing caller is unaffected." It was never applied
structurally.

An H1 identifies the page for a screen-reader user arriving by link, search or
bookmark. A greeting identifies the user — and here not even that, since it was the
same string everywhere.

**Fix:** 76 of those 78 call sites now pass a `title` — 68 across 61 files under
`app/`, plus the 8 in `lib/app/admin-pages.tsx` — taken from each page's existing
`metadata.title` so the H1 and the document title agree. The remaining 2 are
`app/app/my/page.tsx` and `app/app/client/page.tsx`, which keep the greeting on
purpose; both are personal home pages that also render a quote, and both are
allowlisted in the guard test so adding a third is a deliberate act.

> The first draft of this section claimed "70 of 71 call sites". That was wrong
> on both numbers, and so was "66 files". The figures above are counted by
> diffing `a73f55a..HEAD` with the guard's own regex, not estimated.

**Eight more hid in `lib/`.** After the first fix, driving a browser showed
`/app/payroll` still reading `Good morning, Demo.` That page is four lines long:

```tsx
export const metadata: Metadata = { title: "Payroll" };
export default PayrollAdminPage;
```

Its `<PageHeader>` lives in `lib/app/admin-pages.tsx`, a shared module rendering the
bodies of `/app/dashboard`, `/app/payroll`, `/app/hr`, `/app/recruitment`, `/app/crm`,
`/app/clients`, `/app/reports` and `/app/admin` — so **none of those routes contains a
`<PageHeader` of its own**, and a static scan of `app/` could not have found them. All
eight now carry titles (`Overview`, `Payroll`, `HR`, `Recruitment`, `CRM`, `Clients`,
`Reports`, `Admin`), and the guard scans `app/` **and** `lib/`.

**Guard:** `tests/page-heading-contract.test.ts` scans every `PageHeader` call site in
both directories and fails if one has no `title` outside the allowlist. It asserts it
found more than 60 call sites, so the scan cannot pass by silently matching nothing,
and it carries a dedicated assertion that `lib/app/admin-pages.tsx` is covered — the
exact gap that let eight pages through.

### P0 — The team lead's notification inbox was 27 identical rows. Fixed.

All 27 `leave.request` notifications carried the same title **and** the same body:
*"A team member submitted a leave request for review."* Not one named the person, the
leave type, the dates or the duration. The notification's only job is to tell a
manager there is something to act on, and 27 identical rows cannot do that.

The notification was also wrapped in `catch { // Non-blocking }` — a throw there was
invisible, so a manager could simply never learn a request was waiting, with nothing
in the logs to explain why. There were **two** such blocks; the guard test caught the
second one after the first was already fixed.

**Fix:** `lib/leave/notification-body.ts` builds both sentences from parts and is
unit-tested. Failures now `console.error`. Live, verified end to end:

> Team lead: `Demo Employee requested 3 days of Emergency Leave (Oct 30 – Nov 1).`
> Employee: `Your leave request for 3 days (Oct 30 – Nov 1) was approved by Demo HR.`

**Guard:** `tests/leave-notification-body.test.ts`, 16 cases, with a control asserting
the old generic string would fail every actionable-property test.

**The code fix did not clear the inbox, and this section previously implied it
had.** Fixing a generator does nothing about the rows it already produced. The 27
rows were still sitting there, and checking them properly showed something worse
than stale copy: **all 27 pointed at a `leave_request` row that no longer exists**
(verified in chunks of 50 with `error` checked on every read — 0 of 27 resolved).
So they were not merely uninformative but *dead*: nothing to rebuild a correct body
from, and nothing behind the link when a manager clicked one.

Resolution was three parts, not one:

1. **Deleted the 27** via `scripts/cleanup-orphan-notifications.mjs` — dry run by
   default, and scoped to rows that are *both* dead-linked *and* carrying the legacy
   body. A dead-linked row with real content is reported for review instead of
   deleted. 0 matched that second category.
2. **Made the exercises self-cleaning** (see §5) so they stop producing new residue.
3. **Reseeded from live records** with `scripts/seed-qa-notifications.mjs`, which
   imports the app's own builder rather than reimplementing it — reimplementing
   copy logic is what produced the grammar bug described in
   `lib/leave/notification-body.ts`.

The team lead's inbox is now **17 rows, 17 distinct bodies**, down from 27 rows and
1. `scripts/audit/qa-verify-notifications.mjs` asserts distinctness, absence of the
legacy string, and that no row is dead-linked.

### P1 — The approval queue hides work in progress. Open.

`app/app/leave/page.tsx:49` defaults to `?status=pending`. Once the team lead
approves, the request becomes `manager_approved` and **leaves the default view** — the
HR approver has to discover the status filter to find their own queue.

This is very likely why `approval_requests` held **25 rows with `approval_actions` = 0**
before this pass: nothing had ever been actioned, and the second step is not where the
queue opens. `scripts/audit/qa-exercise-leave-workflow.mjs` has to navigate to
`/app/leave?status=manager_approved` explicitly to complete a request.

**Not fixed** — it is a product decision about what the approver's landing view should
be, not a defect I should silently redesign. Recommended: default the queue to the
statuses the current user can act on, per `mapPendingApprovalActability`.

### P2 — Test residue was visible to real users. Fixed.

Two rows from an isolation test sat in `notifications` — type
`test.isolation.iso-test-…`, title `isolation iso-test-…`, body `test` — rendered
indistinguishably from real notifications. Deleted via
`scripts/cleanup-test-notifications.mjs`, which matches only `type LIKE 'test.%'`,
prints what it matched, and defaults to dry run. 0 remaining.

---

## 3. Data population

`audit-data-population.mjs` counts every table the app queries. It distinguishes
**missing** from **empty**, because `select(…, { count: "exact", head: true })` against
a table that does not exist returns `count: null` **and no error** — which reads
exactly like "unknown". The first draft of this audit reported ten "empty" tables
that were simply names I had invented.

| | Before | Now |
|---|---|---|
| Total rows across app tables | **594** | **996** |
| `attendance_records` | 2 | 201 |
| `tickets` / `ticket_messages` | 1 / 1 | 13 / 37 |
| `crm_deals` / `crm_proposals` | 1 / 1 | 7 / 7 |
| `crm_activities` | **0** | 24 |
| `job_posts` / `applicants` / `job_applications` | 1 / 1 / 1 | 5 / 7 / 7 |
| `invoices` / `invoice_items` / `invoice_payments` | 1 / 3 / 1 | 7 / 27 / 4 |
| `documents` | 2 | 8 |
| `notifications` | 27 (27 identical, 27 dead-linked) | 58 (58 distinct, 0 dead-linked) |
| `approval_actions` | **0** | **0** |

Two rows moved *backwards* against the previous draft of this table, and both are
correct:

- **`approval_actions` is 0 again**, not 10. The 10 were written by the leave
  exercise, and the exercise now cleans up after itself (§5), so they no longer
  accumulate. The workflow was genuinely actioned — each run asserts
  `approval_actions` grows `0 -> 2` mid-run before deleting them.
- **`notifications` is 58, not 0 and not 31.** Zero was the honest state after the
  orphan purge and the first self-cleaning runs, but it left the feature with no
  data to display. They were reseeded from live records (§2).

The previous version of this table reported totals that no longer matched the
database (`attendance_records` 202, `ticket_messages` 39, `applicants`/`job_applications`
5, `invoice_items` 28). Every figure above is re-measured from
`scripts/audit/audit-data-population.mjs` at the end of this pass.

**Seeded by** `scripts/seed-qa-fixtures.mjs` — dry run by default, `--apply` to write,
every insert keyed on natural columns and skipped when present. Re-running `--apply`
inserted **0 rows and skipped all 234**, which is the idempotency proof.

**Payroll was deliberately not seeded.** `payroll_periods`/`payroll_records`/`payslips`
were reconciled by `reconcile-payroll-period-overlap.mjs` and `seed-payroll-window.mjs`,
and payslips exist only against finalized periods. Writing rows there would fight that
invariant, and those tables already have enough rows for their pages to render.

### Still thin, and why

| Table | Count | Why it is acceptable |
|---|---|---|
| `push_subscriptions` | 0 | Needs a real device; headless Chromium makes a phantom subscription |
| `nte_responses`, `disciplinary_actions` | 0 | Only exist once an NTE case progresses past `opened`; 1 case exists |
| `attendance_correction_requests` | 0 | Only created when someone files a correction |
| `organizations` | 2 | One internal (Beepa), one client (CloudPeak) |
| `client_settings` | 1 | One row per client org |
| `payslips`, `payroll_components` | 1 / 1 | Tied to finalized periods — see above |

---

## 4. Live workflow exercise

`scripts/audit/qa-exercise-leave-workflow.mjs` drives a real browser through the whole
path and asserts against the **database**, not the DOM:

```
employee@demo  →  leave request  →  teamlead@  approves step 1  →  hr@  approves step 2
```

**13/13 checks pass.** The workflow is two-step (Team Lead → HR).

| Assertion | Result |
|---|---|
| Leave request created and pending | PASS |
| Approval request created at step 1 | PASS |
| Team lead received `leave.request` | PASS |
| Its body names days + dates, not the old generic string | PASS |
| Team lead approved step 1 | PASS |
| Workflow advanced to step 2 | PASS |
| HR approved step 2 | PASS |
| `approval_actions` row written | PASS (0 → 2, then removed on cleanup) |
| Leave left `pending` | PASS (`approved`) |
| Employee received `leave.decision` | PASS |
| Its body names who decided and which dates | PASS |
| **This run left no leave request behind** | **PASS (0 residual before → 0 after)** |

This exercise earned its keep immediately. It caught **two defects I had introduced
myself**, neither of which any typecheck, lint or unit test would have found:

1. **A PostgREST embed against a non-existent column.** I widened
   `employees(profile_id)` to `employees(profile_id, display_name)`. `employees` has no
   `display_name`, so PostgREST rejected the whole select, `leaveRow` came back `null`,
   `profileId` was `undefined`, and the decision notification silently never fired —
   while the leave itself approved perfectly. The page looked fine; the employee was
   simply never told.
2. **A grammar bug in the notification text.** Reusing the pending sentence and
   stripping its prefix produced
   `Your 3 days of leave (Oct 30 – Nov 1). was approved by Demo HR.` — a fragment
   followed by a stray full stop. Found by *reading the live notification*, not by a
   test.

Both are now fixed and covered. The lesson matches §16.4, §20.3, §20.7 and §21.7 of
`SYSTEM_AUDIT.md`: this repo's recurring failure is a tool reporting a confident cause
for something it has not isolated.

### Ticket workflow — `qa-exercise-ticket-workflow.mjs`, 10/10

```
clientadmin@  creates a ticket  ->  operations@  assigns it
```

The live notifications table had only ever held `leave.request` rows and harness
residue, so **both ticket notification paths were unexercised**. They are correct and
correctly distributed:

| Assertion | Result |
|---|---|
| Ticket created by the client contact | PASS (`TKT-20261009-00003`) |
| Ticket starts in `new` | PASS |
| Requester received `ticket.created` | PASS — `We received your request: QA ticket exercise … — payroll question` |
| `ticket.created` names the subject | PASS |
| Assignment exercised | PASS |
| Ticket has an assignee | PASS |
| Assignee received `ticket.assigned` | PASS — `TKT-20261009-00003: QA ticket exercise … — payroll question` |
| `ticket.assigned` names the ticket number | PASS |
| Notifications actually created | PASS (57 → 59) |
| **This run left no ticket behind** | **PASS (0 residual before → 0 after)** |

Both messages already carried identifying detail, so unlike the leave notifications
these needed no fix — they only needed proving.

The assignment control lives on the ticket **detail** page, not the list, and the
select opens a `ConfirmDialog`. Selecting an option and moving on changes nothing,
which is exactly what the first run did — the same trap as the leave workflow.

### Self-cleaning — the fix the verifier caught

Both exercises swept leftovers from *previous* runs at the start and **nothing at the
end**. That is enough to clean the run before the last one and not the last one, so
a session's final run left its rows behind — a ticket, a leave request, and four
notifications that a real user could see. The scripts claimed "cleans up after
itself"; the code did not.

Cleanup now runs in a `finally`, so it fires on the success path *and* on a throw —
a crashed exercise can no longer be the thing that leaves data behind. Both scripts
end with an assertion rather than a comment:

```
PASS  this run left no ticket behind  — 0 residual before -> 0 after
PASS  this run left no leave request behind  — 0 residual before -> 0 after
```

An assertion is only worth what a broken version costs, so this one was
mutation-proved. With the cleanup call replaced by a no-op, the same run reports:

```
FAIL  this run left no ticket behind  — 0 residual before -> 1 after
9/10 checks passed   (exit 1)
```

The residue the mutant left was then removed by the unmodified script's start-sweep,
which is the third independent confirmation that the sweep works.

### Traps this pass hit in its own tooling

Recorded because each produced a report full of defects that did not exist:

- **The app redirects on permission boundaries**, so `page.goto` can be overtaken by
  the app's own navigation. Sampling the body before the URL settles reads a
  half-navigated page. The sweep now waits for the URL to stop moving.
- **A non-empty queue is not our row.** `button:has-text("Approve").first()` grabs the
  *oldest* pending request, so three consecutive runs each approved the previous run's
  leftover while asserting against their own. The reason text now carries a unique
  per-run marker.
- **ConfirmDialog means the button is not the action.** Clicking "Approve" opens a
  confirmation; not clicking through left `approval_actions` at 0 and looked exactly
  like a broken approval engine.
- **Pages render two `PageHeader` call sites** (an early-return variant and the main
  one). A single-match regex patched the first and missed the second — the guard test
  caught it.
- **A select against a non-existent column returns `null` *and* an `error`, and does
  not throw.** `leave_requests` has `start_at` / `end_at`; querying `start_date` /
  `end_date` returned `data: null` on a row that demonstrably existed, and the
  inspection script printed `null` as though it meant "nothing found". This is the
  same defect class as the first §3 draft reporting ten invented table names as
  empty — a read that fails and a read that finds nothing are indistinguishable if
  you only look at `data`. Every read in the new scripts now checks `error` and
  refuses to continue on `null`.
- **A `null` count is not a count.** `select("id", { count: "exact", head: true })`
  returns `count: null` with no error for a table that does not exist *or* has no
  `id` column. Five tables in the first §3 draft read `null` that way. Counting
  every relation from the live PostgREST schema instead gave 86 relations,
  69 non-empty, and exposed that the names being queried (`clients`, `leads`,
  `support_agents`, `knowledge_base_articles`) did not exist at all — the real ones
  are `client_profiles`, `crm_leads`, `ticket_sla_policies`, and there is no
  `support_agents` table.
- **Fixing a generator does not clear its output.** The leave-notification code fix
  left all 27 bad rows in place, and this report described that as "Fixed". It took
  a second look to notice the rows were still there — and that they were also dead
  links, which is why they could not simply be rewritten.

---

## 5. Still open

| # | Item | Why |
|---|---|---|
| 1 | Approver queue defaults to `?status=pending`, hiding step-2 work | Product decision, not a defect to redesign silently |
| 2 | Admin role-assign and cron notification paths | Not exercised; only the leave and ticket paths were proven end to end |
| 3 | Push delivery on a real device | Needs hardware; re-subscribe required after the VAPID rotation |
| 4 | Playwright e2e not running in CI | Needs `RUN_E2E=true` plus secrets |
| 5 | `payslip_items` / `payslip_components` | **Resolved, not open.** They do not exist — an earlier audit of mine guessed them. The app uses `payroll_components`; the population audit reports both as MISSING rather than EMPTY |

The 27 legacy notification rows are **no longer open** — see §2. They were deleted,
and the inbox was reseeded from live records with correct bodies.

---

## 6. Reproducing this

```bash
npx next build && npx next start -p 3100     # in one shell

# read-only
node scripts/audit/audit-data-population.mjs        # what data exists
node scripts/audit/audit-role-sweep.mjs             # every role x page, console errors included
node scripts/audit/qa-verify-notifications.mjs      # distinctness, dead links, legacy bodies

# live workflow (need the server running); each leaves nothing behind
node scripts/audit/qa-exercise-leave-workflow.mjs   # 13 assertions
node scripts/audit/qa-exercise-ticket-workflow.mjs  # 10 assertions

# writers — all dry run by default, all refuse to write without an explicit flag
node scripts/seed-qa-fixtures.mjs            # --apply
node scripts/seed-qa-notifications.mjs       # --apply   (imports the app's own body builder)
node scripts/cleanup-test-notifications.mjs  # --apply   (test.% only)
node scripts/cleanup-orphan-notifications.mjs# --apply   (dead-linked + legacy body only)
```

The three read-only scripts touch nothing. Every writer prints exactly what it
matched before changing anything, and both cleanup scripts re-read afterwards to
confirm rather than trusting the delete's own count.