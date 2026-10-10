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

### P0 — Changing a role silently deleted a person's own access. Fixed.

`lib/admin/actions.ts` `updateInternalMembershipRole` deleted **every**
`membership_roles` row for a membership and inserted one.

`employee` is not a job title — it is the self-service baseline. Measured against
the live `role_permissions`, it carries exactly eight permissions:

```
approvals.act  attendance.self  cash_advance.self  leave.self
nte.self       payroll.self     performance.self  tickets.self
```

That is a person's own leave requests, payslips, attendance, tickets, expenses
and approvals. Every internal membership in the system holds
`[<functional role>, employee]` — all nine staff confirmed in the database — so
promoting **Demo Marketing** to Finance via the admin UI left them holding
`[finance]` and nothing else. Their leave, payslips, attendance and tickets all
disappeared, silently, on an ordinary role change.

The UI actively hid this: it offers a single-role `<select>`, so a second role
was never visible, and the confirmation read *"They will switch to Finance.
Access updates immediately."* — which was not what happened.

**Fix:** the functional role is replaced; the baseline is preserved. The
confirmation copy now says what actually happens. A membership that never had
the baseline does not acquire one — the function preserves, it does not invent.

### P0 — Inviting staff produced an account with no self-service access. Fixed.

`inviteInternalUser` granted exactly one role. Somebody invited as HR ended up
holding `[hr]` alone — so the person just hired could not open their own leave,
payslips, attendance or tickets, and would only discover it after signing in.
The seeds grant the baseline; the invite path did not.

**Fix:** invite now grants the baseline alongside the chosen role. The rule
lives in `lib/admin/role-assignment.ts` so it is unit-testable without a
signed-in admin or a working SMTP provider.

> Both defects lived in the one area §5 of the previous revision recorded as
> "not exercised". They were not theoretical — they were live buttons.

### P1 — Hiring left a stale `applicant` role. Fixed.

`convertApplicantToEmployee` upserted `employee` and left whatever the applicant
already held, so a fresh hire ended up `[applicant, employee]`. The `applicant`
role grants **zero** permissions today, so there was no live access leak — but a
person who is now internal staff should not still be recorded as an applicant,
and the moment anyone grants that role a permission, every hire would silently
carry it.

Hiring now replaces the role rather than sitting beside it. Same lesson as the
role-change defect above, from the other direction: one destroyed a role it
should have kept, this one kept one it should have replaced.

### P2 — "Super Admin" cannot do most of what an admin does. Documented, not changed.

`super_admin` holds **21 of 50** permissions. Measured by driving the app:

| Page | superadmin | hr | owner |
|---|---|---|---|
| `/app/payroll` | Access not allowed | Access not allowed | Payroll |
| `/app/crm` | Access not allowed | Access not allowed | CRM |
| `/app/recruitment` | Access not allowed | Recruitment | Recruitment |
| `/app/clients` | Access not allowed | Access not allowed | Clients |
| `/app/billing` | Access not allowed | Access not allowed | Billing |
| `/app/tickets` | Access not allowed | Access not allowed | Tickets |
| `/app/leave` | Access not allowed | Leave Approvals | Leave Approvals |
| `/app/employees` | Employees | Employees | Employees |

`lib/permissions/can.ts` is a plain set-membership check with **no super_admin
special case**, so this is the role data talking, not the code. It reads as a
deliberate split — `super_admin` holds the *platform* permissions
(`system.manage`, `users.manage`, `roles.manage`, `system.audit.read`) while
`owner` holds the *business* ones (47 of 50).

**Not changed.** Granting 29 permissions to a role is a product decision, and
the two-key model may well be intentional. Flagged because the UI labels the
account "Super Admin", which does not prepare a user for being refused payroll
and CRM. `owner` is the account that can actually administer the business.

Two related oddities, also left alone: a role literally named `admin` grants **0
of 50** permissions, and `owner` is missing `permissions.manage`,
`attendance.correct` and `cms.manage`.

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

### Admin workflow — `qa-exercise-admin-workflow.mjs`, 18/18

The previous revision listed admin role-assign and the cron job as
"not exercised". They are the most privileged buttons in the product, so this
runs all five admin actions through the real UI, asserting against the database
and restoring what it touched.

| Action | Result |
|---|---|
| `runCronDryRun` reports per-job counts | PASS — `missing clock-out: 0, overdue invoices: 1, digests: 6` |
| Cron dry-run is audit-logged | PASS — `{invoice_overdue:1, missing_clock_out:0, notification_digest:6, …}` |
| `sendAdminTestPush` writes a notification | PASS |
| Invite is surfaced to the user when it fails | PASS — `email rate limit exceeded` |
| Role `Update` disabled until a role is chosen | PASS |
| Role change asks for confirmation | PASS |
| **Role change keeps the self-service baseline** | **PASS — `[employee, finance]`** |
| Role change audit-logged with before/after | PASS — `{before:["marketing","employee"], after:["employee","finance"]}` |
| Revoke asks for confirmation | PASS |
| Revoke sets the membership inactive | PASS |
| Revoke is audit-logged | PASS |
| 0 console errors | PASS |
| Account restored exactly | PASS |

**One path could not be exercised here, and is reported as BLOCKED rather than
passing:** invite *account creation*. Supabase rate-limited outbound email
(HTTP 429). That the button surfaces the reason is itself asserted and passes —
so the failure mode is loud, not silent.

Two things this exercise got wrong first, both worth recording:

- **The first "cron is not audit-logged" failure was the test's fault.**
  `audit_logs` stores its JSON in `before_data` / `after_data`, not `before` /
  `after`. Selecting a column that does not exist returns `data: null` plus an
  `error` and does not throw, so the assertion read as a product failure. Same
  trap as §3's invented table names — a failed read and an empty result are
  indistinguishable if you only look at `data`.
- **The users table keys on `display_name`, not email.** `profiles` has no
  `email` column at all, so a `tr:has-text("someone@example.com")` locator can
  never match. Every read in this script now goes through a `must()` helper that
  throws on `error` or `null`.

### Hire workflow — `qa-exercise-hire-workflow.mjs`, 18/18

```
recruiter/HR  moves stage  ->  HR  hires  ->  employee record + membership + role
```

Uses the existing Demo Applicant, who already has a `profile_id`. That is
deliberate: without one the action calls `inviteOrResolveAuthUser`, which sends
an email and is rate-limited here, so the hire path could not be exercised at
all.

| Assertion | Result |
|---|---|
| Signed in as HR — the role that can actually hire | PASS |
| Stage change asks for confirmation | PASS — `Move application stage?` |
| Stage moved to `offer` | PASS |
| `application_stage_history` recorded the move | PASS — `{screening → offer}` |
| Hire button visible to HR | PASS |
| Hire asks for confirmation | PASS |
| Employee record created and active | PASS — `BEE-00023` |
| Hired member has the `employee` role | PASS — `[employee]` |
| **No stale `applicant` role left behind** | **PASS** |
| Membership became `internal` and active | PASS |
| Application is now `hired` | PASS |
| Hire is audit-logged | PASS — `application.hire_convert` |
| 0 console errors | PASS |
| Recruitment left exactly as found | PASS |

**Separation of duties, verified rather than assumed:** the Hire button needs
BOTH `recruitment.manage` and `employees.manage`. Only `owner` and `hr` hold
both, so **Recruiter cannot hire** — the button is absent, not merely failing.
That is correct and intentional; it is asserted here so a future permission
change that quietly widens it will be noticed.

The stage `<select>` opens a `ConfirmDialog`. Choosing a stage and moving on
changes nothing, and the open overlay then intercepts every later click — which
is how the first two runs failed, once as "stage did not change" and once as a
Playwright "element intercepts pointer events". The same ConfirmDialog rule that
bit the leave and ticket exercises applies to recruitment too.

The restore also had a real bug, caught by its own final assertion: it deleted
roles the run *added* but never re-inserted one the run *removed*, so a failed
run left the account with no roles at all. `qa-repair-applicant-membership.mjs`
exists for the case where a killed process never runs its `finally` at all.

### CRM workflow — `qa-exercise-crm-workflow.mjs`, 21/21

```
lead -> qualified -> deal -> proposal -> sent -> accepted -> deal WON -> client organization
```

Eight CRM actions, and `convertWonDealToClient` has the largest blast radius in
the sales module: it creates an organization, client settings, a billing
account, links the deal and writes an audit entry, with a rollback on each
failure branch. None of that had ever run against live data, so none of the
rollback had ever been exercised.

| Assertion | Result |
|---|---|
| Lead created, starts `new` | PASS |
| Lead status advanced to `qualified` | PASS (confirmed dialog) |
| Deal created and linked to the lead | PASS — `PHP 250000`, stage `new_lead` |
| Proposal created (`draft`) | PASS |
| Proposal marked `sent` from the **deal** page | PASS |
| A `sent` proposal gains a status control on the **list** | PASS |
| Proposal accepted | PASS |
| Deal marked `won` | PASS |
| Convert control appears only on a won, unlinked deal | PASS |
| Client organization created, `type=client`, active | PASS — slug `qa-crm-…-org` |
| `client_settings` row created | PASS |
| Deal linked to the new organization | PASS |
| Conversion noted on the deal timeline | PASS |
| Audit-logged | PASS — `crm_deal.convert_client` |
| 0 console errors | PASS |
| CRM left exactly as found | PASS — leads 4→4, deals 7→7, proposals 7→7, orgs 2→2 |

**Owner is the only role that can do this.** `convertWonDealToClient` needs
`crm.manage` **and** `clients.manage`, and neither HR nor Sales holds both — HR
has neither, Sales has `crm.manage` but not `clients.manage`. The whole flow
therefore runs as Owner. Asserted, so a permission change that quietly widens it
gets noticed.

**A workflow with two screens, which cost this script two runs.** A proposal
created through the UI starts as `draft`, and the `/app/crm/proposals` list only
renders a status select for `sent` proposals. The `draft → sent` transition —
"Mark sent" — lives on the **deal detail page**. So the natural attempt to accept
a proposal you just created fails with "did not find some options", which looks
exactly like a broken control. It is not a defect; the transition is on a
different screen. Recorded because "the button is missing" and "the button is on
another page" produce identical evidence.

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
- **A helper that returns data must not be destructured as if it returned an
  envelope.** `must()` already unwraps `{ data, error }`, and the hire exercise
  then did `const { data: moved } = await must(...)` — reading `.data` off the
  row itself, so every assertion saw `undefined`. It reported "stage did not
  change" against a query that worked perfectly when run alone. Three checks
  failed for one stray pair of braces.
- **An assertion set that only ever passes the happy path will not notice its own
  restore breaking.** The hire exercise's cleanup deleted roles the run *added*
  but never re-inserted one the run *removed*, so a failed run left the demo
  applicant with no roles at all. Its final "left everything as it found it"
  assertion is what caught it — which is the argument for that assertion existing
  rather than a print statement saying "cleaned up".

---

## 5. Action coverage — what is and is not proven

There are **81 exported server actions across 21 `"use server"` modules**. "Every
button works" needs a distinction between *rendered* and *exercised*:

- **Rendered** — the control appears on a page a role can reach. Proven by the
  role sweep: 471 page visits, 0 console errors, 0 page errors.
- **Exercised** — driven through the real UI in a browser, with assertions
  against the database, and with the state restored afterwards. This is the
  only evidence that a button *works*.

| Domain | Actions | Exercised end to end |
|---|---|---|
| `lib/leave` | 3 | **3** |
| `lib/admin` | 5 | **5** |
| `lib/recruitment` | 7 | **2** (stage change, hire) |
| `lib/tickets` | 6 | **2** (create, assign) |
| `lib/auth` | 10 | 0 |
| `lib/cms` | 14 | 0 |
| `lib/crm` | 8 | **7** (all but `createLeadFromContact`) |
| `lib/recruitment` (remainder) | 5 | 0 |
| `lib/payroll` | 5 | 0 |
| `lib/documents` | 3 | 0 |
| `lib/notifications` | 3 | 0 |
| `lib/hr/nte-actions` | 3 | 0 |
| `lib/attendance/*` | 8 | 0 |
| `lib/billing` | 2 | 0 |
| `lib/cash-advance` | 2 | 0 |
| `lib/clients`, `lib/employees`, `lib/profile`, `lib/contact` | 4 | 0 |
| **Total** | **81** | **19** |

**19 of 81 actions are exercised end to end.** The other 62 render correctly and
are covered by unit tests and typecheck, but no committed script has yet driven
them through a browser and asserted the resulting rows. That gap is stated
plainly rather than papered over by counting the page sweep as proof — a button
can render perfectly and do nothing, which is exactly how all four defects in
this report were found.

Earlier sessions did leave evidence in `audit_logs` for a few more
(`payroll.period.create`, `applicant.stage_change`, `client.invite`) via ad-hoc
scripts that were not committed as reusable exercises, so the true figure is
somewhere above 12. It is not 81.

`docs/REMAINING_WORK.md` and the table below track what is left.

---

## 6. Still open

| # | Item | Why |
|---|---|---|
| 1 | Approver queue defaults to `?status=pending`, hiding step-2 work | Product decision, not a defect to redesign silently |
| 2 | **Admin role-assign and cron paths** | **Now exercised** — 18/18, see §4. Two defects found and fixed |
| 3 | **Hire pipeline** | **Now exercised** — 18/18, see §4. One defect found and fixed |
| 4 | **69 of 81 server actions not yet driven end to end** | See §5 for the per-domain breakdown. This is the largest remaining gap |
| 5 | Invite *account creation* | Blocked by Supabase email rate limiting (HTTP 429) in this environment |
| 6 | `super_admin` holds 21 of 50 permissions | Deliberate platform-vs-business split, or a gap — a product call. See §2 |
| 7 | Push delivery on a real device | Needs hardware; re-subscribe required after the VAPID rotation |
| 8 | Playwright e2e not running in CI | Needs `RUN_E2E=true` plus secrets |
| 9 | Nothing is pushed to `origin` | `origin/main` is 10 commits and ~371 files behind this branch |
| 10 | Demo tenant decays; gate needs `refresh-demo-timeline.mjs --apply` first | See below — this is an operational landmine, not a code defect |
| 11 | `payslip_items` / `payslip_components` | **Resolved, not open.** They do not exist — an earlier audit of mine guessed them. The app uses `payroll_components` |

**The demo tenant is a clock bomb, and it is worth knowing about before you trust
a red gate.** Several seed scripts wrote relative deadlines with `Date.now()`
offsets — "SLA due +72h", "response due +5d", "interview in +2d". Those are
correct on the day they run and silently rot afterwards. Nothing fails when they
lapse; the demo just decays until an assertion notices.

That happened during this pass: `live-data-smoke` failed with
`expected 1791612576307 to be greater than 1791632745248` — the "stuck ticket"
`TKT-DEMO-0001` had simply slid past its SLA deadline, with no code change at
all. `scripts/refresh-demo-timeline.mjs` re-bases them and is the documented
remedy. Run it before the gate on a tenant that has been idle.

Worse, running it exposed a bug **in the repair tool itself**, which had been
silently failing on part of its own job:

```
re-based 7/9 row(s); 2 failed
FAILED tickets/2ec3bf8e: invalid input value for enum ticket_status: "open"
```

The rule mapped `new` -> `"open"`, and `ticket_status` has no `open` — the enum
is `new | assigned | in_progress | waiting_for_client | resolved | closed`. Every
lapsed `new` ticket was rejected by Postgres and kept its dead deadline, while
the tool reported a mostly-successful run. The status patch is now removed:
re-basing a timestamp is not a reason to move somebody's ticket between workflow
states. After the fix, `9 in flight, none lapsed`.

The general lesson: **a tool that reports partial success needs its failures
asserted, not merely printed.** "7/9" reads like an acceptable outcome.

The 27 legacy notification rows are **no longer open** — see §2. They were deleted,
and the inbox was reseeded from live records with correct bodies.

---

## 7. Reproducing this

```bash
npx next build && npx next start -p 3100     # in one shell

# read-only
node scripts/audit/audit-data-population.mjs        # what data exists
node scripts/audit/audit-role-sweep.mjs             # every role x page, console errors included
node scripts/audit/qa-verify-notifications.mjs      # distinctness, dead links, legacy bodies

# live workflow (need the server running); each leaves nothing behind
node scripts/audit/qa-exercise-leave-workflow.mjs   # 13 assertions
node scripts/audit/qa-exercise-ticket-workflow.mjs  # 10 assertions
node scripts/audit/qa-exercise-admin-workflow.mjs   # 18 assertions (1 path may report BLOCKED)
node scripts/audit/qa-exercise-hire-workflow.mjs    # 18 assertions

# recovery, if a run was killed before its cleanup
node scripts/audit/qa-repair-applicant-membership.mjs   # --apply

# writers — all dry run by default, all refuse to write without an explicit flag
node scripts/seed-qa-fixtures.mjs            # --apply
node scripts/seed-qa-notifications.mjs       # --apply   (imports the app's own body builder)
node scripts/cleanup-test-notifications.mjs  # --apply   (test.% only)
node scripts/cleanup-orphan-notifications.mjs# --apply   (dead-linked + legacy body only)
```

The three read-only scripts touch nothing. Every writer prints exactly what it
matched before changing anything, and both cleanup scripts re-read afterwards to
confirm rather than trusting the delete's own count. Every workflow exercise
restores what it changed and then **asserts the restoration**, so a failing run
says so rather than leaving damage behind quietly.