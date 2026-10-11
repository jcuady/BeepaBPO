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
| Unit/contract | `npx vitest run` | **558 passed, 89 files** |
| Production build | `npx next build` | **exit 0** |
| Release gate | `node scripts/verify-all.mjs` | **18/18 — "All checks passed. Ship it." — exit 0** |
| **Per-role page sweep** | `scripts/audit/audit-role-sweep.mjs` | **13 roles × nav-reachable pages + 10 marketing pages = 471 visits** |
| **Data population** | `scripts/audit/audit-data-population.mjs` | **every table the app queries** |
| **Live workflow exercise** | `qa-exercise-leave-workflow.mjs` | **employee → team lead → HR, 13 assertions** |
| **Ticket workflow exercise** | `qa-exercise-ticket-workflow.mjs` | **client admin → operations, 10 assertions** |
| **Admin workflow exercise** | `qa-exercise-admin-workflow.mjs` | **18 assertions** |
| **Hire workflow exercise** | `qa-exercise-hire-workflow.mjs` | **18 assertions** |
| **CRM workflow exercise** | `qa-exercise-crm-workflow.mjs` | **21 assertions** |
| **Payroll workflow exercise** | `qa-exercise-payroll-workflow.mjs` | **19 assertions** |
| **Auth workflow exercise** | `qa-exercise-auth-workflow.mjs` | **35 assertions** |
| **Attendance workflow exercise** | `qa-exercise-attendance-workflow.mjs` | **31 assertions** |
| **CMS workflow exercise** | `qa-exercise-cms-workflow.mjs` | **42 assertions** |
| **Recruitment jobs exercise** | `qa-exercise-recruitment-workflow.mjs` | **23 assertions** |
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

### P0 — Any session could change the account password. Fixed.

`changePasswordAction` validated **only the new password** and then called
`supabase.auth.updateUser({ password })`. supabase-js treats a live session as
sufficient authority to rotate a credential, so the sole thing being checked was
"is somebody signed in" — and the answer to that is yes, for whoever holds the
browser. `components/app/settings/change-password-form.tsx` had no current-password
field either, so there was nothing to check even in principle.

This is **CWE-620, Unverified Password Change**. The blast radius is total: reset
the password from a borrowed or hijacked session and the real owner is locked out of
their own account, with no current password to appeal to and no second factor.

**Fix:** `changePasswordAction` re-authenticates with
`signInWithPassword({ email, currentPassword })` and returns before touching
`updateUser` if it fails. Three settings surfaces — internal settings, client
settings, applicant profile — share the form, so all three now collect the field.

The failure message is deliberately one string for every cause. Supabase's raw text
distinguishes a wrong password from a disabled or unknown account, which would turn
this form into an account-status oracle. A phone-only account has no `email` to
verify against and is refused rather than falling back to trusting the session,
which is the exact hole the check exists to close.

**Proof, in the browser** (§4): the exercise now *attempts the takeover first* — a
change with a wrong current password is refused, the new password is then confirmed
**not** to work for sign-in, and the real password is confirmed still working. A
happy-path test alone would have passed against the old code too.

### P0 — "Sign out everywhere" existed as code and nowhere else. Fixed.

`logoutAllAction` — the only path that revokes refresh tokens on the user's *other*
devices — was referenced by nothing outside its own definition. The account menu
offered a single "Sign out", which calls `logoutAction`, which signs out **locally**.

So a user who suspected a compromised session had no recourse at all. Signing out
ends the browser in front of them, which is the one browser they no longer trust.

`tests/auth-signout-scope.test.ts` had a guard for exactly this file and it passed,
because it asserted the function *exists*:

```ts
expect(actions).toContain('signOut({ scope: "global" })');
expect(actions).toContain("logoutAllAction");
```

The changelog went further and claimed the global path was now "reachable only on
purpose". It was reachable never.

**Fix:** "Sign out everywhere" is now in the account menu, and the exercise proves
it *works* rather than merely that the label exists — it establishes a second
session, clicks the control, and asserts the second session is gone.

### P2 — Signup blamed the user's address for a rate limit. Fixed.

Measured in this environment: Supabase answers **every** `signUp` with
`429 email rate limit exceeded`. `signupAction` reported all of them as
"Unable to create account with that email." A prospective client at the very top of
the funnel was told their address was bad when nothing was wrong with it — so they
retype the same address, fail identically, and leave.

`lib/auth/error-messages.ts` already argued this exact case for sign-in: *"a message
that cannot distinguish the two causes sends every investigation down the wrong
path."* `signupErrorMessage` is now its counterpart, with the same shape and the
same three cases.

Note what is **not** claimed: the signup success path is still unproven, because
this environment cannot execute it. Account creation reports BLOCKED, and the
exercise asserts only that the rate limit is *reported as a rate limit* rather than
as a bad address.

### P1 — An approved attendance correction stored times 8 hours out. Fixed.

`lib/attendance/zoned-time.ts` exists because manual attendance entry used to store
timestamps 8 hours out of step with clocked ones, and `upsertAttendanceRecord` was
routed through `zonedWorkDateTime` to fix it. The **correction path was never
converted.** `resolveCorrectedClockTimes` is pure string arithmetic, and the value
it receives comes from an `datetime-local` input — a naive `2026-10-10T08:00` that
Postgres casts as `08:00Z`, which is 16:00 in Asia/Manila.

Measured on the live demo tenant, driving the real UI:

```
employee requested a corrected shift of 08:00 - 17:00 Manila
the record stored  2026-10-10T08:00:00Z  and  2026-10-10T17:00:00Z
which DISPLAY as   4:00 PM              and  1:00 AM
```

**What makes this dangerous rather than merely wrong is that `worked_minutes` still
came out at 540.** Both endpoints moved by the same amount, so the duration
survived and payroll hours looked right. Everything anchored to a wall clock —
overtime after 18:00, a night differential, the times a supervisor reads on the
heatmap — was reading eight hours of nothing. A payslip showing 540 minutes is
indistinguishable from a correct one; only the displayed times give it away.

**Fix:** `reviewAttendanceCorrection` resolves the requested values through the
employee's `default_timezone` before merging, via a new `naiveDateTimeToZoned` in
`corrected-times.ts` — kept next to `resolveCorrectedClockTimes` so the two halves
of the correction path cannot drift apart again. A value the converter cannot read
is stored verbatim rather than dropped, so a malformed request surfaces as what the
employee actually sent.

The exercise now proves this the only way that counts: after approval, **the time
the record shows in the employee's own timezone must equal the time they asked
for.** Asserting that "some timestamp was written" would have passed either way.

### P2 — CMS content can never be deleted. Documented, not changed.

`lib/cms/actions.ts` exports create, update and status actions for six content
types. It exports **no delete action at all**, and there is no `.delete()` call
anywhere in the file. A draft created in error, a test row, a withdrawn
case study — none can be removed by anyone, through any interface.

Archive is a soft delete and may well be the intended model. It is recorded
because it was not an obvious design decision from the UI: the CMS page shows
Publish and Archive on every row and no delete control anywhere, so the
constraint is invisible until someone needs it.

Not changed. Adding a hard delete to a published marketing site is a product
decision with retention implications. The absence is asserted by the exercise so
that adding delete later is a deliberate act rather than an accident of drift.

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

### P1 — A release gate depended on demo rows nothing guaranteed. Fixed.

The gate went red at 16/18. Two steps failed — *Vitest (full suite)* and *Live data
smoke (DB state)* — for **one** cause: `live-data-smoke.test.ts` runs inside the full
suite, so a single bad assertion takes down both steps.

```
tests/live-data-smoke.test.ts:143  expect(interviews).toBeGreaterThanOrEqual(1)   received 0
tests/live-data-smoke.test.ts:144  expect(assessments).toBeGreaterThanOrEqual(1) received 0
```

Both tables were empty while the surrounding data was perfectly healthy: 6
`job_applications`, 6 `applicants`, 15 `application_stage_history`, 5 `job_posts`, and
no orphaned applications. The last verified green gate was 18/18 at `a4977c5`.

**Ruling out the obvious cause.** Cascade is the obvious suspect and it is wrong here.
Both FKs are `on delete cascade` from `job_applications`
(`supabase/migrations/20260906001100_ats_crm_cms.sql:115,136`), so deleting an
application *would* take its interviews and its assessments with it — but it would
equally take its `application_stage_history` rows. History survived at 15. An
application was never deleted, so cascade never fired. `qa-inspect-ats-provenance.mjs`
confirms this directly: all 6 applications still carry their original ids and their
original September–October `created_at` values. Nothing was recreated either.

Nor was the recruitment exercise the culprit, despite being the last thing that ran.
Its cleanup deletes applications only for job posts whose slug carries the run marker,
and deletes applicants only by `profile_id` — and all 6 applicants have
`profile_id = null`, so that delete matches nothing. Its 6 applications and 5 job
posts are its own, and it left the originals untouched.

No script in the repo and **no product code at all** deletes from either table.

**The real defect.** Those rows were only ever created by
`scripts/audit/batch3-workflows.mjs:214-241` — an ad-hoc audit script. The canonical
seed, `scripts/audit/apply-data-seed.mjs`, never creates them; its only "interview"
occurrences are prose inside marketing copy. So a release gate was asserting on state
that no reproducible process was responsible for producing. Whether the rows were
dropped by something outside the repo or never survived a data reset, the guarantee
was missing either way, and a gate that depends on an undeclared side effect is a gate
that will go red again for reasons that have nothing to do with the code.

Fixed by `scripts/audit/qa-seed-ats-interviews.mjs`, which creates one interview and
one assessment per application, only where missing, never touching a row that exists.
It is idempotent (a second run creates 0) and it reads the counts back rather than
trusting its own insert payload. Result: 6 interviews, 6 assessments, verified by
read, and `live-data-smoke` back to 12/12.

### P2 — The pipeline has interview and assessment stages with nothing to record them in. Documented, not changed.

A consequence of the investigation above, and worth stating on its own: the ATS lets a
recruiter move an application to **Initial interview** or **Assessment**
(`lib/recruitment/application-stage.ts:26,27`), and the schema has `interviews` and
`assessments` tables sitting behind those stages. **Nothing in the product reads or
writes either table.** A search across `lib/`, `app/` and `components/` returns one
hit, and it is the word "interviews" in a FAQ answer about sourcing.

So the stages are real and reachable, but they are a dead end: an application can be
marked as having reached an interview with no way to record *who* interviewed, *when*,
*where*, or *how it went*. The three demo applications sitting at `initial_interview`
and `assessment` display a pipeline position the product cannot substantiate.

**Not changed.** Building interview scheduling and assessment capture is a feature,
not a fix, and it needs product decisions this QA pass is not entitled to make. Flagged
so the pipeline is not read as more complete than it is.

### P2 — The realtime probe could not tell "late" from "never". Fixed.

The gate went red again on step 16: `subscribed OK`, row inserted, and
`PROBE_RESULT=DELIVERY_FAILED` — no event within 15000ms. Run on its own, immediately
afterwards, the same probe passed twice.

The probe polled to a flat 15s deadline and, on expiry, printed the same
`DELIVERY_FAILED` whether the event was never going to arrive or merely arrived late.
Those are different faults with different owners, and it had no way to tell them apart
— so a red gate reported a cause it had not established.

Measured, the delivery is fast: **496ms** and **267ms** across two standalone runs,
against a 15000ms budget. A 30–50x margin is not a system drifting toward slow; the
gate failure was not a genuine latency regression.

Fixed by making the probe measure instead of assume. It records when the event
actually fired, keeps polling past the budget to a 60s ceiling, and reports the
measured latency on every run. `LATE` is now its own result with its own exit code, so
`verify-all.mjs` surfaces a delivery-latency problem as exactly that — never as an
outage, and never folded into the pass count either.

**And a contract test caught the fix, correctly.** `tests/realtime-probe-contract.test.ts`
went red on the new polling loop. Its negative control was
`.replace("while (!fired && …) {", "if (false) {")` — `replace`, not `replaceAll`, so it
neutralised only the *first* of the probe's two loops and then reported the correct
probe as broken. The control's intent was sound; it just mutated one site of two. Now
`replaceAll`, with a comment saying why.

The added control for the new `LATE` assertion initially shipped wrong: it mutated the
`PROBE_RESULT=LATE` marker and then asserted on the *exit code*, which that mutation
never touches — so it failed while telling us nothing about the guard. Split into two
independent mutations, one per pinned fact.

### P0 — An employee's Notice to Explain was accepted and silently thrown away. Fixed.

`submitNteResponse` inserts into `nte_responses`, then runs
`update nte_cases set status = 'under_review'`. The insert always worked — the
employee holds `nte.self`. **The update never did.**

`nte_cases` carries exactly two policies (`20260906001000_hr_payroll.sql:343,351`):
a SELECT policy, and an `for all` policy gated on `nte.manage`. An employee holds
`nte.self`, not `nte.manage`, so RLS rejected the update. The action never read the
error, so it returned **"Response submitted."** anyway.

Measured on the demo tenant: the response text was stored, the case stayed at
`issued`, and the employee was told it had been filed. The employee believes they
have answered; HR's list shows a case that reads as unanswered while carrying a
response nobody is told to look for. Nothing anywhere reported an error, because
there was nowhere for one to surface.

**The obvious fix is worse than the bug.** A `for update` policy scoped to
`is_self_employee(employee_id)` would let any employee update their own case — and
RLS cannot restrict *columns*, so they could set `resolution_type`, `resolved_by`,
`resolved_at` and `resolution_notes` on their own Notice to Explain. That turns a
status bug into an employee being able to mark their own case cleared, or record a
dismissal against themselves.

Fixed instead by moving the whole write into one narrow `SECURITY DEFINER` function
(`20261010120000_nte_response_submission.sql`, applied): it resolves the caller's own
employee row from `auth.uid()`, checks ownership and that the case is open, inserts
the response and flips the status, and returns the new status. It **cannot resolve a
case** — no resolution columns are in scope at all. The employee keeps no direct
UPDATE on `nte_cases`. The action now reads the error and distinguishes the three
failure modes, so a refusal is a refusal rather than a silent success.

### P1 — An HR response deadline reached the employee a day late. Fixed.

`createNteCase` stored `response_due_at` straight from a `datetime-local` input —
`lib/hr/nte-actions.ts:48` — exactly the write that was a user-visible bug in the
attendance correction path one module over. Postgres casts a bare timestamp as UTC.

HR set a deadline of **17:00 on 9 March**. The row stored `2026-03-09T17:00Z`, and
`/app/my/nte` rendered **"Due Mar 10, 2026"** — the employee is told they have a day
longer than HR granted, or, with an early-morning deadline, a day less.

**My first reading of this was wrong, and the assertion caught it.** Reasoning from
the code alone, `my/nte` renders the *date only* and the date component round-trips
through a UTC cast unchanged, so I expected no user-visible effect and wrote the
offset down as a latent note. Measuring what the employee actually sees showed
otherwise: the render happens in Asia/Manila (UTC+8), so a 17:00 instant lands on the
next calendar day there. The note would have shipped a real defect described as
harmless.

Fixed on both halves, because either alone is only half a fix: the write now converts
through `naiveDateTimeToZoned` in the employee's own timezone (mirroring
`reviewAttendanceCorrection`), and the render uses a new `formatZonedDate` instead of
`format(new Date(...))`, so the deadline is not read in whatever zone the host happens
to run in. After the fix the stored instant matches the wall clock HR typed exactly,
and the employee sees "Due Mar 9, 2026".

### P2 — The HR NTE search box did nothing. Fixed.

`/app/hr/nte` renders `FilterBar placeholder="Search subject or case number…"`, reads
`q` with `stringParam`, echoes it back as `defaultValue`, and passes it to the pager.
It never applied it: the Supabase query had no `.or()` and no `.ilike()`. Typing a
case number returned the entire unfiltered list, with nothing indicating the search
had been ignored.

This is worth naming as a class, because the release gate has a "Page wiring (no dead
controls)" step and it passed. That audit can see a control that renders and submits;
it cannot see a control that submits correctly and is then ignored by the query it was
meant to reach. Fixed with the same `ilikePattern` + `.or()` the tickets and audit-log
pages already use.

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

### Payroll workflow — `qa-exercise-payroll-workflow.mjs`, 19/19

```
salary settings -> open a run -> seeded records -> recalculate
               -> submit for approval -> finance approves -> owner approves -> FINALIZED
```

Payroll is the highest-consequence surface in the product and none of its five
actions had ever been driven through the UI. `reviewPayrollPeriod` can
**finalize** a period and flip every record in it to finalized — real money
state — and none of its rollback branches had executed.

Isolation mattered here more than anywhere else. Rather than touch the live
`finalized` (Sept 1–15) or `draft` (Sept 16–30) periods, this opens **its own**
period for the current frequency window, which does not overlap either. The one
pre-existing value it edits — an employee's base salary — is snapshotted and
restored exactly.

| Assertion | Result |
|---|---|
| Salary settings form renders | PASS — 10 rows |
| Salary change persisted | PASS — `120000 -> 120111` |
| Wizard picks a frequency with no existing period | PASS — Monthly |
| New period created, starts `draft` | PASS — `October 1–15, 2026` |
| Records seeded for the period | PASS — 10 records |
| Seeded records start `draft` | PASS — 10/10 |
| Recalculate writes a `calculation_snapshot` | PASS |
| Submit for approval moves it to `approval` | PASS |
| An `approval_request` was created | PASS |
| **Approval chain took two steps** | **PASS — 2 approvals** |
| Period finalized after the chain | PASS |
| Every record in the period finalized | PASS — 10/10 |
| 0 console errors | PASS |
| Payroll left exactly as found | PASS — periods 2→2, records 11→11, **payslips 1→1**, salary restored |

**Payroll approval is two steps, not one.** `approval_steps` holds step 1 =
`finance`, step 2 = `owner`. A single approval correctly leaves the period at
`approval`; finalizing takes both. The first run clicked Approve once and
reported "finalize broken" — it was not broken, it was halfway. Same shape as
the leave workflow, and the reason `approval_actions` sat at 0 for so long.

**No product defect surfaced in payroll.** Two defects did surface in *my own
exercise*, both worth recording because both could have done real damage:

- **An attribute selector does not see a DOM property default.** The salary
  inputs render with no `type` attribute, so `input[type="text"]` matched **0**
  elements on a page with ten inputs. It looks like the form is empty.
- **The snapshot and the edit pointed at different employees.** The settings
  page orders by employee number; `payroll_profiles` returns primary-key order.
  Snapshotting "row 1" and editing "the first input" edited two different
  people — and the run's own restore, keyed to the wrong id, failed with
  `invalid input syntax for type uuid: "undefined"` and left a real salary
  bumped. The script's verification assertion caught it; a script without that
  assertion would have quietly altered someone's pay. The input id is
  `salary-<employee_id>`, so the employee is now derived from the row actually
  being edited.

That second one also prompted deleting a line from the cleanup that deleted
payslips "just in case" for whichever employee had been edited. The exercise
never creates payslips, and that line would have destroyed real payslip rows.
**Cleanup must only ever remove rows the run demonstrably created.**

### Auth workflow — `qa-exercise-auth-workflow.mjs`, 35/35

`lib/auth` held **10 actions and none of them had been driven end to end.** Every
other exercise signs in implicitly, so `loginAction` was covered by accident; the
other nine were not. Two were security defects (§2).

| Surface | What was proven |
|---|---|
| `loginAction` | A wrong password is refused and says so |
| `forgotPasswordAction` | Byte-identical reply for a real and a fabricated address — **no account enumeration** |
| `verifyEmailAction` | A bogus token is refused with "invalid or has expired" |
| `employeeLoginAction` | An internal user passes; a client user is refused *and their real client session survives* |
| `changePasswordAction` | Takeover refused, credential verified unchanged, legitimate change succeeds, restored through the UI |
| `logoutAction` | Ends this browser's session; the other device stays signed in |
| `logoutAllAction` | **Revokes the other device** |
| `switchAccountAction` | A membership-less user reaches access-denied and can escape it |
| `signupAction` | Reached; **account creation BLOCKED** by the environment's 429 |
| `resetPasswordAction` | **Not driven** — needs a real recovery token from an inbox |

The account-menu run prints its own inventory, which is how the missing control was
seen rather than inferred:

```
NOTE  account menu items: Demo Marketing Marketing · Beepa BPO Profile Settings
      Notifications Sign out Sign out everywhere
```

Three assertions in this pass are worth more than the rest, and each one exists
because the naive version would have passed against the broken code:

- **The takeover is attempted, not the happy path.** A change with a wrong current
  password must be refused, *and* the attacker's new password must then be shown not
  to work for sign-in. Asserting only that the correct change succeeds would have
  been green before the fix.
- **"Sign out everywhere" is proved to work, not to exist.** The second session is
  established, the control is clicked, and the second session is asserted dead.
  Finding the label in the menu proves the wiring, not the behaviour.
- **Cleanup is verified by reading the rows back** — 13 → 13 memberships, 13 → 13
  auth users, 58 → 58 notifications — because printing "cleaned up" is the same
  unverified claim as a write without a read.

`BLOCKED` is a distinct outcome from pass and fail, and it is used honestly here:
Supabase answers **every** `signUp` in this environment with 429, so signup account
creation cannot be executed at all. The script does not fold that into the pass
count, and does not leave it permanently red either — it proves the one thing that
*is* provable under a 429, which is that the app now says "Too many sign-up attempts
from this network" instead of blaming the address.

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

### Attendance workflow — `qa-exercise-attendance-workflow.mjs`, 31/31

Eight actions across four `"use server"` modules in `lib/attendance`, none previously
driven. Six are exercised here; the client timesheet pair is not.

| Action | What was proven |
|---|---|
| `clockIn` | Creates today's record with `clock_in_at`, no `clock_out_at` |
| `clockOut` | Sets `clock_out_at`; `worked_minutes` matches the actual gap |
| `createAttendanceCorrection` | Creates a pending request **and** an approval request on the `attendance_correction` workflow |
| `reviewAttendanceCorrection` | HR approves; times applied, `worked_minutes` recomputed, record finalized |
| `upsertAttendanceRecord` | HR manual entry stores times in the employee's timezone |
| `deleteAttendanceRecord` | Removes a draft record through the dialog |

The run is built around one question — **does a correction land on the times the
employee actually asked for?** — and answers it the only way that discriminates:

```
requested 08:00 - 17:00 Manila
before:  stored 08:00:00Z / 17:00:00Z   ->  displays 4:00 PM - 1:00 AM   FAIL
after:   stored 00:00:00Z / 09:00:00Z   ->  displays 8:00 AM - 5:00 PM   PASS
```

It also runs a **control**: HR manual entry goes through the already-correct
`zonedWorkDateTime` path, and the run asserts it reads back right. Without that,
a failure on the correction path could not be told apart from "the timezone is
wrong" rather than "the correction path is wrong". Same employee, same timezone,
same kind of wall-clock reading, two code paths.

Two guards deliberately not exercised, both recorded rather than quietly skipped:

- The **finalized-record guard** is never tested by deleting a live row through the
  service role. That bypasses RLS, so it would prove nothing about the action's
  guard while risking real demo data, and a faithful restore would have to
  reconstruct the original `employee_id` and `work_date`. An earlier draft of this
  script did exactly that. **Proving a guard must not require destroying what it
  guards.**
- `worked_minutes` is asserted as *consistent with the stored pair*, not as
  greater than zero. Clock in and clock out happen seconds apart in a test run, so
  the honest value is 0 — and a `> 0` assertion reports a correct record as broken
  purely because the test was fast.

### CMS workflow — `qa-exercise-cms-workflow.mjs`, 42/42

All **14** actions in `lib/cms/actions.ts` — the largest single block in the app, and
until now the least exercised. **No product defect.** Everything created, edited,
published, archived, and cleaned up exactly as intended:

| Content type | create | edit | publish | archive |
|---|---|---|---|---|
| blog post | ✅ | ✅ | ✅ (`published_at` set) | ✅ |
| service | ✅ | ✅ | ✅ | ✅ |
| FAQ | ✅ | ✅ | ✅ | ✅ |
| industry | ✅ | ✅ | ✅ | ✅ |
| testimonial | ✅ | ✅ | ✅ | ✅ |
| case study | ✅ | ✅ | ✅ | ✅ |
| About page | ✅ (`upsertAboutPage`) | — | — | — |

`setCmsContentStatus` is exercised twice per content type — publish, then archive —
so all six of its branches run rather than one.

Two structural facts this pass established rather than assumed:

- **There is no delete action anywhere in `lib/cms/actions.ts`.** Content can be
  created, edited, published and archived — never removed. A CMS with no delete
  means a mistaken or test row lives forever. That may be deliberate (Archive is a
  soft delete), so it is documented rather than fixed, and the exercise deletes
  its own rows through the service role, which is the only route a real user does
  not have. Recorded as its own finding.
- **`cms.manage` is held by exactly one role: `marketing`.** Not `owner`, not
  `super_admin`, not `hr`. This extends the §2 `super_admin` finding: the account
  the UI calls "Super Admin" cannot open the CMS at all. Measured by calling the
  `user_permission_codes` RPC **signed in as each demo user** — joining
  `role_permissions` gives the same answer, but the RPC is what the app actually
  consults, and the two are not the same source of truth.

The permission guard itself is proven negatively: a second browser context signed
in as `owner` loads `/app/cms` and is asserted to receive **no CMS content and no
creation forms**. Note that this is asserted on *content*, not on the URL —
`requirePermission` calls Next's `forbidden()`, which does not reliably change the
address, and a URL-only check reported "owner reached the CMS" for a page that had
already refused them.

### Recruitment jobs workflow — `qa-exercise-recruitment-workflow.mjs`, 23/23

The five `lib/recruitment` actions not covered by the hire pass. **No product
defect.**

| Action | What was proven |
|---|---|
| `createJobPost` | Creates the post, leaves it `draft` |
| `updateJobPost` | Persists an edit through the detail page's own form |
| `publishJobPost` | Moves to `published` and stamps `published_at` |
| `closeJobPost` | Moves to `closed` and **preserves** the original `published_at` |
| `submitJobApplication` | Creates the application at stage `applied` |

Two lifecycle facts proven rather than assumed: a **closed** role is not offered to
an applicant at all, and a closed role **can be re-published**. Publishing an
already-published post has no control left to click — the action's idempotent
early-return is unreachable from this UI, so the check falls back to asserting the
status is still `published`.

The applicant path writes to shared state, and the exercise treats that as the
danger it is: `submitJobApplication` does not create a fresh applicant. It looks
the caller up by `profile_id` and **updates** the existing row's
first_name / last_name / email / phone / linkedin_url. The demo applicant row is
snapshotted before the run and restored field for field, and the restoration is
asserted by comparing values — including the deliberate exclusion of `updated_at`,
since any write bumps it and comparing it would report a false failure for a
perfectly restored row.

One guard is unreachable from the UI: after applying, the form is replaced, so the
"you have already applied for this role" branch cannot be re-driven by a second
click. It is asserted at the data level instead — exactly one application exists
for the role.

### NTE workflow — `qa-exercise-nte-workflow.mjs`, 24/24

The most sensitive workflow in the product: HR issues a Notice to Explain, the named
employee answers, HR resolves it with a disciplinary outcome. Three actors, so the
assertions that matter are about **who may act**, not about whether a form saves.

| # | Assertion | Result |
|---|---|---|
| 1 | HR reaches `/app/hr/nte` with the case form | PASS |
| 2 | `incident_type` is a free-text field, not an enum select | PASS |
| 3 | `createNteCase` writes a case | PASS |
| 4 | New case starts in status `issued` | PASS |
| 5 | Case is issued by the HR user | PASS |
| 6 | Incident date stored as typed | PASS |
| 7 | Employee sees their own case on `/app/my/nte` | PASS |
| 8 | **Deadline shown to the employee is the date HR typed** | PASS *(failed first: showed Mar 10 for a Mar 9 deadline)* |
| 9 | Employee gets a response form for their case | PASS |
| 10 | `submitNteResponse` writes a response | PASS |
| 11 | **Responding moves the case to `under_review`** | PASS *(failed first: stayed `issued`)* |
| 12 | Second case created for another employee | PASS |
| 13 | **Another employee's NTE case is not visible to this employee** | PASS |
| 14 | The HR search filter narrows the list to the case under test | PASS *(failed first: 2 of 3 cases)* |
| 15 | Resolve form is shown while the case is open | PASS |
| 16 | Resolve confirmation dialog opens | PASS |
| 17 | `resolveNteCase` sets status `resolved` | PASS |
| 18 | `resolveNteCase` stores the resolution type | PASS |
| 19 | A non-cleared resolution writes a disciplinary action | PASS |
| 20 | **A stale tab is refused: cannot be resolved from status `resolved`** | PASS |
| 21 | The refused attempt wrote no second disciplinary action | PASS |
| 22 | The refusal left the resolution untouched | PASS |
| 23 | No unexpected console errors | PASS |
| 24 | No page errors | PASS |

Three assertions failed on the first run and each turned out to be a real product
defect, not a harness problem: 8, 11 and 14 are written up in §2.

**The stale-tab case is the interesting one.** `/app/hr/nte/page.tsx:136` renders the
resolve form only while a case is open, so the UI already stops you resolving twice —
which also means the guard inside `resolveNteCase` cannot be reached by clicking twice.
It is reachable the way it actually matters: two HR tabs. The run opens a second tab
in the same browser context *before* the first resolves, then submits the stale form,
so the guard is watched refusing rather than merely observed to exist. It refused with
`cannot be resolved from status "resolved"`, wrote no second disciplinary action, and
left the resolution untouched.

That required getting the harness right first. The second tab is created with
`hrContext.newPage()`, not `browser.newPage()`: `browser.newPage()` opens a **fresh
browser context with its own cookie jar**, so the "stale HR tab" landed on `/login` and
rendered no resolve form at all. The run then reported the guard as missing while
actually testing an anonymous visitor. Both tabs are also narrowed with the page's own
`?q=` search filter, because two open cases each render an identically labelled
"Resolve NTE" button and `.first()` would fill one case's notes and submit the
other's.

### Notifications workflow — `qa-exercise-notifications-workflow.mjs`, 16/16

Mark one read, mark them all read, change a delivery preference. No product defect.

The hazard this run is built around is that **`markAllRead` updates every notification
the signed-in user owns**. A QA script that clicks it and afterwards deletes only its
own rows has still silently marked every other notification in the demo account read,
and nothing reports it. So the run snapshots `read_at` for all 17 of the subject user's
notifications *before* touching anything and restores each value afterwards, comparing
against the snapshot rather than against a remembered id list.

| Assertion | Result |
|---|---|
| The other user's notification starts unread | PASS |
| The page renders the QA notifications | PASS |
| **Another user's notification is not shown** | PASS |
| Unread rows are marked `Unread` | PASS |
| `markNotificationRead` sets `read_at` | PASS |
| `markNotificationRead` leaves other notifications alone | PASS |
| The *Mark all read* button appears while something is unread | PASS |
| `markAllRead` marks every one of the user's notifications read | PASS |
| **`markAllRead` does not touch another user's notification** | PASS |
| The page shows no unread rows afterwards | PASS |
| The email digest preference toggle is present | PASS |
| `updateNotificationPreferences` persists a row | PASS |
| The persisted value matches the toggle the user left | PASS |
| Toggling back writes the original value | PASS |
| No unexpected console errors | PASS |
| No page errors | PASS |

Restoration verified by read-back: 17 `read_at` values restored, **0** mismatching the
snapshot, 0 notifications left carrying the marker, total row count back to 58.

One assertion failed first for a reason worth recording. `aria-checked` hands back the
**string** `"true"` while the column holds a **boolean**, so `"true" === true` fails
while printing two identical values on either side of the message — a failure that
reads exactly like a product defect and is not one.

### Profile / employee / contact workflow — `qa-exercise-profile-workflow.mjs`, 19/19

Four actions in three modules, plus the last unexercised CRM action.
`createLeadFromContact` is reachable in production *only* through the public contact
form, so driving `/contact` closes both at once. No product defect.

| Assertion | Result |
|---|---|
| HR sees the employee edit form | PASS |
| `updateEmployee` persists the new job title | PASS |
| `updateEmployee` writes an audit row | PASS |
| Owner sees the profile form | PASS |
| **The profile form is pre-filled from the database** | PASS |
| `updateProfile` persists the display name | PASS |
| `updateProfile` persists the phone | PASS |
| `updateProfile` writes an audit row | PASS |
| **Clearing the phone stores null, not an empty string** | PASS |
| The contact form confirms receipt to the enquirer | PASS |
| `contactAction` creates exactly one lead | PASS |
| The lead is sourced from the website form | PASS |
| The lead lands in the sales queue as `new` | PASS |
| A honeypot submission is told it succeeded | PASS |
| **A honeypot submission writes no lead** | PASS |
| An invalid email is refused at step 1 | PASS |
| No lead is written for invalid input | PASS |
| No unexpected console errors | PASS |
| No page errors | PASS |

The contact form is a three-step wizard, and the honeypot (`website`) returns a success
message **without writing anything** — correct anti-spam behaviour, and very easy to
mistake for "the form works" if a run submits the happy path and stops. So all three
paths are submitted and asserted separately: one real enquiry (one lead), one
honeypot-filled (told it succeeded, zero leads), one invalid (refused, zero leads).

**What that invalid-email assertion does and does not prove.** It proves *client-side*
validation: the input is `type="email"` with `required`, so the browser blocks the
submit and `contactAction` is never called. The server-side `contactSchema` rejection
path is **not** exercised, because the UI cannot reach it. Recorded as a note rather
than quietly counted as coverage.

Restoration verified: employee record and owner profile both restored field by field,
`crm_leads` back to 4, 0 leads carrying the marker.

### Money workflow — `qa-exercise-money-workflow.mjs`, 33/33

The only two actions in the product that move money, plus the multi-step approval
behind one of them. **No product defect.**

**Invoice status machine.** `recordInvoicePayment` recomputes the invoice status from
the **sum of its payment rows**, not from the amount just entered. A partial payment
must land on `partially_paid`, and only the payment that takes the total over the
invoice total may reach `paid`. Only exercising the full payment would pass with the
partial branch broken, so the run pays ₱1,000 of ₱3,751.50 first:

- invoice total is `3 × 1250.50 = 3751.50`, currency stored upper-cased as `PHP`
- exactly one line item, whose amount equals the invoice total
- partial payment → `partially_paid`, exactly one payment row
- settling the balance → `paid`
- **and the payment form is then hidden**, so a paid invoice cannot be paid again

**`paid_at` is the NTE bug's near-miss, and the run checks it rather than assuming.**
The field is `type="date"`, so the submitted value is a bare `YYYY-MM-DD` that
JavaScript parses as UTC midnight. That stays on the same calendar day for any host
between UTC−12 and UTC+11, so ₱5 March reads back as 5 March. Had it carried a time
component — as the NTE deadline did — it would be eight hours out. Recorded as a note
because the difference is the whole point: the same idiom is safe in one field and a
defect in another, and only measuring tells them apart.

**Cash advance is a two-step approval, not a boolean.** `createCashAdvanceRequest`
opens the approval workflow itself (step 1, `pending`) *and* sets the entity to
`hr_review`. `reviewCashAdvance` then advances it. The run asserts the status the
workflow actually produced rather than assuming `approved`: it produced
**`finance_review`**, with an `approval_actions` row recorded by the engine.

**A false defect, caught.** The first run of this script reported that the cash advance
did not move out of `hr_review` — one step from filing a P0. It was the harness. The
review queue lists every open request and **every row carries an identically labelled
"Approve" button**, so `getByRole("button", { name: "Approve" }).first()` approved
whichever request sorted first — not the one just created. The click is now scoped to
the `<tr>` carrying the run's marker, and the ConfirmDialog's confirm is scoped to the
dialog rather than taking the page's last "Approve".

Two related corrections came out of chasing it: the approval request is created by the
**submit** step, so the run now captures its id at creation instead of inferring after
the fact that "1 approval row exists" proved the review happened; and the refusal text
is captured from the page rather than guessed, so an approval that genuinely cannot
proceed reports *why*.

Restoration verified by read-back: invoices 7→7, items 27→27, payments 4→4, advances
2→2, and 1 approval request + its action row created by the run removed.

### P2 — Every filter on every internal list page is live — and two of them were proved so the harness itself could be trusted

`qa-exercise-list-filters.mjs`, **27/27 on 20 pages**, 0 defects.

The action coverage in §5 counts server actions. It does not cover the other half of
a list page: the GET filter form. A filter can render, sit in a proper form, submit a
correct query string and then be **ignored by the query it was meant to reach** — the
page changes nothing and reports a confident, complete, wrong list. That is not
hypothetical: it is exactly what the NTE search box was (§2, P2), and the release
gate's "no dead controls" audit passed the whole time, because that audit can see a
control that submits and cannot see a query that ignores it.

Two invariants, chosen so neither has an escape hatch:

- **A search must respond to a string that matches nothing.** The run types a per-run
  marker that cannot occur in any seeded row and requires the result set to change.
  A search that returns the unfiltered list for a no-match string is dead.
- **A dropdown must be able to change something.** Selects have no no-match value and
  an option can legitimately return the same rows as "all", so the invariant is
  weaker but still falsifiable: *at least one* option value must produce a different
  result set. A dropdown where no option does anything is inert.

Plus two guards that keep the result honest: a page whose unfiltered list is empty is
**skipped** for the dropdown leg (with no rows, no filter can change anything, and
reporting that as inert would be the same mistake pointed the other way), and a
dropdown with no effect is printed as a **candidate for confirmation against its
table**, never concluded to be a defect from the DOM alone.

`/app/approvals` has no filter form at all and is reported as such rather than
skipped silently.

#### The first run of this script reported 14 dead filters. All 14 were the script.

That is worth recording in full, because the failure looked exactly like a product
defect and two of the named pages had been fixed and proven earlier in this same
session — `/app/hr/nte` above all, whose search box this report lists as **Fixed**.

Three harness bugs, all of the same family — a locator that looks right and is not:

1. **`.first()` filled the CREATE form, not the filter form.** Most of these pages
   render a second form above the filter: "Create ticket", "Create NTE case",
   "Upload". On `/app/hr/nte` the first text input on the page is `incident_type`;
   on `/app/tickets` it is `subject`; on `/app/my/documents` it is `title`. The run
   was filling those fields and then clicking "Create NTE case".
2. **The submit button was the CREATE form's button.** `form button[type=submit]`
   `.first()` matched "Create ticket" / "Upload", not "Apply". So the filter form was
   rarely submitted at all.
3. **The fingerprint removed every `<form>`.** On `/app/hr/nte` that stripped 435 of
   928 characters, and on any list whose rows sit inside a form (the per-row status
   and assign selects) it deletes the rows themselves — reducing the fingerprint to
   page chrome and making every comparison equal.

The fix is to identify the filter form **by its Apply button** and remove only that
one form. Nothing about the product changed; the run went from 14 reported defects to
zero, without touching a line of application code.

#### Waiting for the URL is not waiting for the content

The corrected run still reported one dead filter — `/app/recruitment/jobs`, where the
query reached the URL and the list did not change. It was wrong again, for a fourth
reason: the run waited for the URL to stop moving and then sampled. A Next.js
client-side transition updates the address bar **immediately** and streams the RSC
payload afterwards, so "the URL has settled" says nothing about whether the new
markup is on screen. Measured directly, that search works correctly — 5 job posts
unfiltered, 0 plus the `No job posts` empty state when filtered.

The harness now samples the fingerprint until **two consecutive reads agree**. This
one change also un-skipped four pages (`/app/employees`, `/app/billing`,
`/app/admin/users`, and the NTE row) that the stability control had been rejecting
for "content is not stable across two identical loads" — they were not unstable, they
were being sampled mid-render.

The rule this earns, which is the same one the source-contract guards in this repo
keep re-learning: **before reporting a defect from a harness, prove the harness can
detect the thing it is looking for.** Both times here, a positive control on a page
already known to work — `/app/hr/nte` and `/app/tickets` — would have caught the
instrument before it produced a list of fourteen defects that did not exist.

### P2 — Every document in the demo was undownloadable. Two causes, both fixed.

The documents module itself is the best-written in the codebase: it checks its errors,
rolls back the storage object when the metadata write fails, validates MIME and size,
and derives visibility from the caller's permission. **No product defect found.** The
three actions pass 31/31.

What the run found instead is that **the demo data under it was dead**: all 8 seeded
document rows resolved to a storage object that did not exist, so the documents page
rendered a full, plausible list in which **every Download button failed**. The employee
could not open their own employment contract, handbook or certificate of employment.

Three separate faults stacked up:

1. **The rows pointed at a bucket that does not exist.** `scripts/seed-qa-fixtures.mjs:451`
   hardcoded `storage_bucket: "documents"`. No such bucket, and no product code ever
   writes to one — the product uses `employee-documents` and `client-documents`. The
   script inserted metadata only, never uploading a byte, and reported the fixtures as
   seeded. Fixed at the source and repaired in place by
   `qa-repoint-document-bucket.mjs`.

2. **No bytes were ever uploaded**, for any of them. Repointing the bucket would have
   produced 8 rows that look seeded and still fail. `qa-seed-document-blobs.mjs` writes
   a labelled placeholder PDF at each missing path — honest about being a demo rather
   than inventing contracts nobody produced — and verifies by minting a signed URL and
   fetching it, because "I wrote 8 objects" proves nothing about what lands.

3. **The paths could not have worked even with a bucket.** `storage_employee_docs_select`
   (`20260906000800_storage_buckets.sql:53`) evaluates
   `public.is_self_employee(((storage.foldername(name))[1])::uuid)` — it casts the
   **first path segment** to uuid. The seeded paths were `demo/<employee_id>/…`, so the
   cast was applied to the literal string `demo` and Postgres raised:

   ```
   invalid input syntax for type uuid: "demo"
   ```

   `qa-repair-document-paths.mjs` moves each object to `<employee_id>/<file>`, the layout
   the policy and `uploadEmployeeDocument` actually use.

**The policy itself is still wrong, and is not changed here.** A hard `::uuid` cast makes
a malformed path *raise* rather than *deny*. An RLS predicate should refuse quietly and
let the application return "you do not have access to this file"; this one turns an
unlucky path into a database type error surfaced to the user, and it does so for **every**
user who touches the bucket, not only the owner. Widening a predicate is a security
decision, so it is documented rather than taken — but it is a live footgun, and the next
writer who invents a path layout will hit it.

After the repair: 8 of 8 rows serve bytes, and the exercise asserts it end to end — the
employee opens a *pre-existing seeded* document, not just the file the run uploaded,
because "the file I just uploaded downloads" says nothing about the seven that were
already broken.

### Documents workflow — `qa-exercise-documents-workflow.mjs`, 31/31

| Assertion | Result |
|---|---|
| Employee sees the upload form | PASS |
| `uploadEmployeeDocument` writes a document row | PASS |
| The document is attached to the uploading employee's record | PASS |
| **A self-upload is `private`** | PASS |
| The recorded size matches the uploaded bytes | PASS |
| The upload writes an audit row | PASS |
| **A Download control is offered for the document** | PASS |
| Clicking Download opens a signed URL | PASS |
| The signed URL is served successfully | PASS |
| **The signed URL returns exactly the bytes that were uploaded** | PASS |
| A pre-existing seeded document is listed to this employee | PASS *(added after the repair)* |
| **A pre-existing seeded document can also be downloaded** | PASS *(was: `invalid input syntax for type uuid: "demo"`)* |
| The seeded document serves real bytes | PASS *(HTTP 200, 704 bytes)* |
| A disallowed MIME type is refused and writes nothing | PASS |
| An upload with no file is refused and writes nothing | PASS |
| HR sees an upload form on another employee's record | PASS |
| The admin upload writes a document | PASS |
| It is attached to the employee HR chose, not to HR | PASS |
| **An upload made on someone's behalf is `employee_visible`, not `private`** | PASS |
| Another employee's document is not listed to this employee | PASS |
| The employee still sees their own document | PASS |
| Client admin sees the upload form | PASS |
| `uploadClientDocument` writes a document | PASS |
| The client document is tied to a client organization | PASS |
| **A client upload is `client_visible`** | PASS |
| The client upload writes an audit row | PASS |
| No unexpected console errors | PASS |
| No page errors | PASS |
| No document row is left carrying the marker | PASS |
| **No storage object is orphaned** | PASS |
| The documents table is back to its starting size | PASS |

Visibility is the load-bearing assertion here: `private` for self-upload,
`employee_visible` for an admin uploading on someone's behalf, `client_visible` for a
client upload. That is derived from the caller's permission, so it is asserted three
ways rather than once.

Cleanup removes the metadata **and** the blobs, then asserts both: 3 rows, 3 objects,
0 orphans, table back to 8. A row deleted while its blob is left behind is worse than no
cleanup — the next upload's random UUID will not collide with it, so an orphan just
accumulates invisibly.

### P2 — The client timesheet hand-off writes no audit trail at all. Documented, not changed.

`lib/attendance/client-timesheet.ts` is the **only** module in this codebase whose
actions change an approval status and contain **no `logAudit` call whatsoever**. Every
other action audited during this pass writes a row.

That matters more here than in most places, because this is the one workflow that crosses
the Beepa/client boundary with money attached: `submitTimesheetForClientReview` moves a
timesheet day into a client's queue, and `reviewClientTimesheet` is where the client
finalizes it or sends it back. After the round trip there is **no record of who decided
what, or when**. `reviewClientTimesheet` also has no approval trail in `approval_requests`
— it is not driven through the `advanceApprovalRequest` engine that the cash-advance and
leave workflows use, so it is the only cross-organisation approval in the product with no
workflow record at all.

**Not changed.** Adding an audit trail to an approval path is a compliance decision, and
it is cheap to add once agreed; deciding *what* must be recorded and retained is not a QA
pass's call.

### P2 — `/app/attendance` offers "Send to client" to employees who have no client. Documented, not changed.

`app/app/attendance/page.tsx` computes:

```ts
const canSend =
  canSubmit &&
  row.approval_status !== "client_review" &&
  row.approval_status !== "finalized";
```

It never checks whether the employee has an active client assignment — which
`submitTimesheetForClientReview` then *requires*, returning *"Employee has no active
client assignment."* So an internal user is shown a control that is guaranteed to fail,
for every employee on the team who is not assigned to a client. Measured: the exercise
found 1 such row offered in the same week where the assignment was actually valid.

Every other list in the product pairs its action button with the same predicate the
action enforces. This one does not.

### P1 — Beepa can hand a timesheet to a client who will never see it. Documented, not changed.

`submitTimesheetForClientReview` accepts a hand-off whenever the employee has an
**active** `client` assignment whose `client_organization_id` is set
(`lib/attendance/client-timesheet.ts:198-212`). It does **not** compare the timesheet's
`work_date` against that assignment's window.

`client_attendance_summary` — the view `/app/client/timesheets` reads — **does** apply
that window. Measured, not assumed: with the assignment starting `2026-09-05`, a fixture
dated `2026-06-15` was absent from the view while the *same record* dated `2026-09-06`,
`2026-09-10` and `2026-11-02` appeared immediately, under the service role, which bypasses
RLS entirely.

So an internal user can hand over a timesheet day that predates the employee's client
assignment. The action reports **"Timesheet submitted for client review."** The record is
in `attendance_records` with `approval_status = client_review`. It is simply not in the
client's queue, and there is nothing anywhere saying so — the client's queue is empty and
Beepa's side shows it as submitted. A timesheet day silently disappears between two
organisations.

**Not changed.** Whether the correct fix is to date-check at submission, to widen the
view, or to surface a warning is a product decision with payroll consequences either way.
What is not a product decision is that the two components disagree today.

This was found by the run reporting BLOCKED and someone going to look, rather than by a
gate. **A blocked leg is worth the investigation** — this one turned out to be a real P1
sitting behind an unexercised action.

### Client timesheet workflow — `qa-exercise-client-timesheet-workflow.mjs`, 13/14

The only workflow that crosses the Beepa/client boundary with a status hand-off. Both
actions exercised, **both directions of the review** — Approve (`finalized`) and
*Send back* (`supervisor_review`) — because only exercising Approve leaves the branch
that returns work to Beepa completely untested.

| Assertion | Result |
|---|---|
| A draft timesheet exists for a client-assigned employee | PASS |
| Internal user is offered *Send to client* for the day | PASS |
| **`submitTimesheetForClientReview` moves the record to `client_review`** | PASS |
| The timesheet hand-off writes an audit row | **FAIL — no `logAudit` in the module** |
| The submitted day is no longer offered for submission | PASS |
| The timesheet appears in the client review queue | PASS *(was BLOCKED)* |
| The client is offered Approve | PASS |
| **`reviewClientTimesheet` approve finalizes the record** | PASS *(was BLOCKED)* |
| The finalized day leaves the client review queue | PASS |
| The client is offered *Send back* | PASS |
| **`reviewClientTimesheet` "Send back" returns it to `supervisor_review`** | PASS *(was BLOCKED)* |
| **`Send to client` is offered for an employee with no client assignment** | PASS *(the mismatch is real)* |
| The fixture rows are gone | PASS |
| The attendance_records count is back to its starting size | PASS |

**The BLOCKED outcome earned its keep.** The first run reached `client_review` and then
could not see the record in the client's queue, even read as service role. Rather than
round the number up, the leg was reported BLOCKED with its evidence — and chasing it
produced the P1 above. The fixture was being dated `2026-06-15`, before the assignment's
`2026-09-05` start, so the view excluded it; moving it inside the window made the whole
client leg work on the next run.

Chasing it also caught a flaw in my own probe: its first attempt to isolate the date
moved the record onto a date the employee **already had a row for**, so the
`(employee_id, work_date)` unique constraint rejected the update, the error was not read,
and the "same employee, same date" test silently re-ran the previous one. The fixed
version walks genuinely free dates and reads each update's error.

**What the environment actually offered.** Probed before writing anything:
`allow_timesheet_approval` is true and there are 2 active client assignments, but **no**
attendance record for a client-assigned employee that is not already `finalized` (199 of
201 finalized). Nothing to drive, so the run creates the timesheet day as a fixture and
deletes it afterwards, asserting the count is back to 201.

One hardening noted for whoever picks it up: `reviewClientTimesheet`'s final update checks
`error` but **not the affected row count**. PostgREST returns no error when an update
matches zero rows, so a concurrent hand-off would let the action report "Timesheet
approved." while nothing changed — the same shape as the P0 in §2.

### Tickets workflow — `qa-exercise-tickets-workflow.mjs`, 33/33

Covers the four actions the admin pass had not driven: `postTicketMessage`,
`updateTicketStatus`, `createTicketSlaPolicy` and `updateTicketSlaPolicy`.

| Leg | What it asserts |
|---|---|
| Reply | First staff reply stamps `first_response_at`; a **second** reply does not move that clock |
| Reply | The message is stored `internal = false`, not as an internal note |
| Status | Resolving stamps `resolved_at`; reopening **clears** it rather than leaving a stale resolution date; an audit row is written |
| SLA create | A policy whose resolution target is shorter than its first-response target is refused, and no row is written |
| SLA edit | The same cross-field rule holds on the update path, and a valid edit persists both targets and writes an audit row |

**No product defect in this domain.** The reply-clock, status-transition and SLA
validation behaviour is all correct, and the reopening-clears-`resolved_at` check is
worth keeping precisely because it is the shape a status machine usually gets wrong.

**One structural finding — the SLA create action is unreachable in a configured org.**
`app/tickets/sla/page.tsx:36` builds `byPriority` from **every** policy of the org
without consulting `active`, and renders a create form only for a priority with no
policy row at all:

```tsx
const byPriority = new Map((policies ?? []).map((p) => [p.priority, p] as const));
const missing = PRIORITIES.filter((p) => !byPriority.has(p));
```

All four priorities are configured here, so the form is never rendered, and there is
no delete action for SLA policies anywhere in the product — so once an org has all
four, `createTicketSlaPolicy` is **dead code** in that org, permanently. This is the
same shape as the CMS delete gap in §2 and is documented, not changed: the fix is a
product decision about whether an org should be able to remove a priority's policy.

Rather than report the action untested, the run frees a priority and drives it for
real. Two approaches were rejected first, and both rejections are instructive:

- **Writing a sentinel `priority` does not work.** `priority` is
  `public.ticket_priority`, an `enum ('low','normal','high','urgent')`, so
  `'qa_parked'` is rejected by Postgres outright — and all four legitimate values are
  already taken, which is the whole reason the slot is full.
- **Deleting the policy row does not work either.** `tickets.sla_policy_id`
  references it `on delete set null` (`20260906000900_client_tickets_billing.sql:119`),
  so the delete would silently detach the SLA from real tickets, and re-inserting the
  row afterwards would not put those links back. That is collateral damage to live
  demo data in the name of a QA run.

What works is moving the row to a **scratch organization**. `organization_id` is part
of the unique index `(organization_id, priority)`, so moving it frees the slot while
the row keeps its `id` — and therefore every FK that points at it.

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
- **`head: true` returns `data: null`, so counting rows through `.length` compares
  `0` to `0`.** The auth exercise's "nothing leaked" check ran
  `select("id", { count: "exact", head: true })` on both sides of a before/after
  comparison. With `head: true` the `data` is `null`, so both sides measured `[]`
  and the check passed **no matter what the run destroyed**. It now reads the
  `count` field, which is the only thing that can distinguish the two cases.
- **Base-UI renders a menu item as `role="menuitem"`, not as a `<button>` or `<a>`.**
  A locator scoped to `[role=menu] button, [role=menu] a` reported "no 'Sign out'
  item found in the menu" while the menu plainly contained it — a working control
  reported as missing. The harness was wrong and the product was right; the run
  prints the menu's own text so that a selector mistake cannot masquerade as a
  defect a second time.
- **A helper that returns data must not be destructured as if it returned an
  envelope — and an admin API can return an *object* where you expect an array.**
  `auth.admin.listUsers()` resolves to `{ data: { users: [...] } }`. Running that
  through a `must()` helper and calling `.find` on the result throws, while
  destructuring `{ data }` yields an object that merely *looks* empty.
- **A restore that changes a row without changing the row count cannot be verified
  by counting.** This pass's SLA leg parks a policy under a scratch org and moves it
  back. The cleanup block checked five counts — tickets, messages, policies, and two
  marker scans — and **every one of them passes identically whether or not the move
  was rolled back**: a moved row is still a row, and it still carries the same name.
  The `finally` also restored `name`, both targets and `active`, while omitting
  `organization_id` entirely, so the one field that was actually changed was the one
  field left behind. The fix is to read each pre-existing row back **by id, with no
  org filter** (so a stranded row is found rather than reported as missing) and compare
  **field by field**. A tally cannot fail on a value.

---

## 5. Action coverage — what is and is not proven

There are **83 exported server actions across 21 `"use server"` modules**, counted
by `scripts/audit/qa-action-inventory.mjs` rather than maintained by hand — the
figure was previously given as 81, and attendance's 8 actions were listed as though
they lived in one file when they are spread across four
(`actions.ts`, `client-timesheet.ts`, `corrections.ts`, `manage.ts`). A hand-kept
table is a claim, and this report is specifically about refusing claims in place of
evidence. "Every button works" needs a distinction between *rendered* and
*exercised*:

- **Rendered** — the control appears on a page a role can reach. Proven by the
  role sweep: 471 page visits, 0 console errors, 0 page errors.
- **Exercised** — driven through the real UI in a browser, with assertions
  against the database, and with the state restored afterwards. This is the
  only evidence that a button *works*.

| Domain | Actions | Exercised end to end |
|---|---|---|
| `lib/leave` | 3 | **3** |
| `lib/admin` | 5 | **5** |
| `lib/recruitment` | 7 | **7** (2 from the hire pass, 5 here) |
| `lib/tickets` | 6 | **6** (2 from the admin pass: create, assign; 4 here: reply, status, both SLA actions) |
| `lib/auth` | 10 | **8** (signup reached but 429-blocked; `resetPasswordAction` not driven) |
| `lib/cms` | 14 | **14** |
| `lib/crm` | 8 | **8** (`createLeadFromContact` via the public contact form) |
| `lib/payroll` | 5 | **5** |
| `lib/documents` | 3 | **3** |
| `lib/notifications` | 3 | **3** |
| `lib/hr/nte-actions` | 3 | **3** |
| `lib/attendance/*` (4 modules) | 8 | **8** |
| `lib/billing` | 2 | **2** |
| `lib/cash-advance` | 2 | **2** |
| `lib/clients` (1) | 1 | 0 |
| `lib/employees` (1), `lib/profile` (1), `lib/contact` (1) | 3 | **3** |
| **Total** | **83** | **80** |

**80 of 83 actions are exercised end to end.** The other 3 are the auth-email
actions — `signupAction`, `resetPasswordAction` and `inviteClientUser` — which
Supabase refuses environment-wide with **HTTP 429**. They render correctly and are
covered by unit tests and typecheck, but no committed script has driven their success
path through a browser, and that gap is stated plainly rather than papered over by
counting the page sweep as proof — a button can render perfectly and do nothing,
which is exactly how every defect in this report was found.

They are all three the *same* gap, not three unrelated ones: each one asks Supabase to
send an email. `signupAction` has been reached and its failure path proven to report
the rate limit correctly rather than blaming the address; what is unproven is the
success path, and nothing else in the product is waiting on it.

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
| 4 | **26 of 83 server actions not yet driven end to end** | See §5. NTE (3), documents (3), notifications (3), clients/employees/profile/contact (4), billing (2), cash-advance (2), client timesheet pair (2). All single-digit blocks now — see §4 |
| 5 | Invite *account creation*, and **signup account creation** | Blocked by Supabase email rate limiting (HTTP 429) in this environment. The signup *error path* is now proven to report the rate limit correctly rather than blaming the address; the success path is not. Check the blocker with `node scripts/audit/check-auth-email-rate-limit.mjs` — it exits 0 the moment the limit clears, and deletes anything it creates |
| 6 | `super_admin` holds 21 of 50 permissions | Deliberate platform-vs-business split, or a gap — a product call. See §2 |
| 7 | Push delivery on a real device | Needs hardware; re-subscribe required after the VAPID rotation |
| 8 | Playwright e2e not running in CI | Needs `RUN_E2E=true` plus secrets |
| 9 | Nothing is pushed to `origin` | `origin/main` is 10 commits and ~371 files behind this branch |
| 10 | Demo tenant decays; gate needs `refresh-demo-timeline.mjs --apply` first | See below — this is an operational landmine, not a code defect |
| 11 | `payslip_items` / `payslip_components` | **Resolved, not open.** They do not exist — an earlier audit of mine guessed them. The app uses `payroll_components` |
| 12 | `resetPasswordAction` | Needs a real recovery token from an inbox; no mail provider in this environment. The invalid-token path on `verifyEmailAction` *is* proven |

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
node scripts/audit/qa-exercise-crm-workflow.mjs     # 21 assertions
node scripts/audit/qa-exercise-payroll-workflow.mjs # 19 assertions
node scripts/audit/qa-exercise-auth-workflow.mjs    # 35 assertions (signup reports BLOCKED under 429)
node scripts/audit/qa-exercise-attendance-workflow.mjs # 31 assertions
node scripts/audit/qa-exercise-cms-workflow.mjs        # 42 assertions
node scripts/audit/qa-exercise-recruitment-workflow.mjs # 23 assertions
node scripts/audit/qa-exercise-nte-workflow.mjs      # 24 assertions
node scripts/audit/qa-exercise-notifications-workflow.mjs # 16 assertions
node scripts/audit/qa-exercise-profile-workflow.mjs      # 19 assertions
node scripts/audit/qa-exercise-money-workflow.mjs        # 33 assertions
node scripts/audit/qa-exercise-documents-workflow.mjs     # 31 assertions
node scripts/audit/qa-exercise-client-timesheet-workflow.mjs # 13/14, one real finding
node scripts/audit/qa-exercise-tickets-workflow.mjs          # 33 assertions
node scripts/audit/qa-exercise-list-filters.mjs             # 27 assertions across 20 list pages
node scripts/audit/check-auth-email-rate-limit.mjs          # exits 0 the moment the 429 clears
node scripts/audit/qa-probe-client-timesheet.mjs          # read-only: can this flow run here at all?
node scripts/audit/qa-probe-summary-view-filter.mjs     # read-only: which predicate hides a record from the client view

# demo repair, all dry run unless --apply
node scripts/audit/qa-repoint-document-bucket.mjs   # --apply
node scripts/audit/qa-repair-document-paths.mjs      # --apply
pnpm seed:demo:documents                            # writes the missing placeholder PDFs

# recovery, if a run was killed before its cleanup
node scripts/audit/qa-repair-applicant-membership.mjs   # --apply
node scripts/audit/qa-probe-signup-error.mjs            # read-only: what Supabase says back per domain
node scripts/audit/qa-inspect-attendance-identities.mjs # read-only: which user owns which employee record
node scripts/audit/qa-inspect-ats-provenance.mjs        # read-only: who owns each application, and what children survived
node scripts/audit/qa-cleanup-orphan-correction-approvals.mjs # --apply
node scripts/audit/qa-cleanup-leaked-attendance.mjs     # --apply

# demo data a release gate asserts on, but that no seed produced (§2, P1)
pnpm seed:demo:ats              # idempotent: one interview + one assessment per application

# coverage, counted rather than maintained by hand
node scripts/audit/qa-action-inventory.mjs              # 21 "use server" modules, 83 actions

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