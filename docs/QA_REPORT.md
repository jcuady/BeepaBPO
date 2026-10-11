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
| Unit/contract | `npx vitest run` | **622 passed, 92 files** |
| Production build | `npx next build` | **exit 0** |
| Release gate | `node scripts/verify-all.mjs` | **18/18 — "All checks passed. Ship it." — exit 0** (re-verified on a clean `.next` after the four fixes below; an earlier run that day read 16/18, because I shipped a type error and the gate caught it) |
| **Per-role page sweep** | `scripts/audit/audit-role-sweep.mjs` | **489 visits, 13 roles + 10 marketing pages, 0 errors.** Evidence: `docs/evidence/role-sweep.json`. A working CSV download used to be counted as a page error — see §5 |
| **Data population** | `scripts/audit/audit-data-population.mjs` | **every table the app queries** |
| **Live workflow exercise** | `qa-exercise-leave-workflow.mjs` | **employee → team lead → HR, 13 assertions** |
| **Ticket workflow exercise** | `qa-exercise-ticket-workflow.mjs` | **client admin → operations, 10 assertions** |
| **Admin workflow exercise** | `qa-exercise-admin-workflow.mjs` | **18 assertions** |
| **Hire workflow exercise** | `qa-exercise-hire-workflow.mjs` | **23 assertions** |
| **Reset password exercise** | `qa-exercise-reset-password.mjs` | **8 assertions** |
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

Measured in this environment: Supabase answers `signUp` with
`429 email rate limit exceeded` often enough that the path looked permanently dead.
`signupAction` reported all of them as "Unable to create account with that email." A
prospective client at the very top of the funnel was told their address was bad when
nothing was wrong with it — so they retype the same address, fail identically, and leave.

`lib/auth/error-messages.ts` already argued this exact case for sign-in: *"a message
that cannot distinguish the two causes sends every investigation down the wrong
path."* `signupErrorMessage` is now its counterpart, with the same shape and the
same three cases.

**Update, later in the same session — this gap is now closed.** The blocker was assumed to be
permanent. It is not: the environment's email budget is finite rather than closed, and once it
allowed one call through, `signupAction` was driven end to end through the real form.
`qa-exercise-signup-workflow.mjs` submits the actual signup form and then proves the result
against the service-role API rather than trusting the banner:

| Assertion | Result |
|---|---|
| The form reports the account was created | PASS — "Account created. Check your email to verify before signing in." |
| A real auth user exists for that address afterwards | PASS |
| `signupAction` granted the applicant membership | PASS |
| That membership carries the applicant role | **not yet proven** — see below |

The last two matter more than they look. `assignApplicantMembership` runs in a `try/catch`
that discards its error and returns silently on every failure path, so a success banner with
no membership would have been invisible from the UI alone. The banner is what the component
renders; the two service-role reads are what the action actually did.

The fourth assertion is listed as unproven deliberately. It exists in the committed script and
it is correct, but the budget was exhausted before the run reached it — it aborted on a schema
error of my own (`membership_roles` has no `id` column; it is the `(membership_id, role_id)`
pair) and by the time that was fixed the environment had stopped accepting signups again. The
assertion is therefore **unverified**, not passing, and the table says so rather than rounding
it up to the three that did run.

Re-running is currently **BLOCKED again** — the budget was spent by the run above — and the
script reports that as its own outcome (exit 2, `BLOCKED`, `0/0 assertions`) rather than as a
failure, because a rate-limited environment and a broken signup form are different problems
and must not be reported the same way. The copy the user sees in that state is the corrected
one: *"Too many sign-up attempts from this network. Wait a minute, then try again."*

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

`super_admin` holds **22 of 50** permissions (21 before `cms.manage` was granted — see below). Measured by driving the app:

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

**Measured, because "22 of 50" is not decidable — the set is.**
`qa-inspect-super-admin-gaps.mjs` reads `role_permissions` directly and prints both sides.
It changes how this should be read, in two directions that pull opposite ways:

1. **The 29 are a least-privilege default, not an enforced boundary.** `super_admin` holds
   `roles.manage` *and* `permissions.manage`, so it can grant itself anything it is
   missing. That makes "22 of 50" a starting posture rather than a wall, and means the
   number should not be reported as a vulnerability. `lib/permissions/can.ts` has no
   super_admin special case precisely because the role data is expected to carry the policy.
2. **`cms.manage` was the one item here that read as a defect.** It was held by **exactly
   one role, `marketing`** — not by `owner`, not by `super_admin`. Every other permission in
   the system is held by at least two roles. Practically, the ability to edit the website is
   a single marketing seat: if that person leaves, nobody who administers the system can
   change the marketing content, and recovery means a direct database write.

No permission is dead config — all 50 are held by at least one role. So the remaining 28
are a defensible split; `cms.manage` is the one worth a decision.

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

### P1 — Every "record not found" page in the app was a dead end with no navigation. Fixed.

There was no `not-found.tsx` anywhere in this codebase — not at the root, not under
`/app`. Next.js served its built-in not-found document, and that document contains
**zero links**. Verified, not assumed: before the fix, `/app/no-such-page` rendered
`404 / This page could not be found.` with `document.querySelectorAll('a').length === 0`
— no header, no sidebar, no logo, and the marketing `<title>` on an internal-tool page.

The blast radius is much wider than a mistyped URL. **12 app routes call `notFound()`**
for a missing record:

```
app/app/tickets/[id]              app/app/crm/deals/[id]        app/app/recruitment/applicants/[id]
app/app/employees/[id]            app/app/crm/leads/[id]        app/app/applicant/jobs/[id]
app/app/billing/[id]              app/app/recruitment/jobs/[id] app/app/my/requests/[id]
app/app/payroll/periods/[id]      app/app/client/tickets/[id]   app/app/client/billing/[id]
```

So opening a deleted ticket, employee, invoice, payroll period, deal, lead or job was
a dead end. This is not hypothetical reach: §6 row 15 documents a payroll audit link to
a period the payroll exercise deletes, and any stale `action_url` in a notification
lands the same way. In a tool staff use all day, "the record I was sent to no longer
exists" is a normal event, and it ended in a page with no way out.

Three files fix it:

- **`app/not-found.tsx`** (new) — public 404. Reuses `SiteHeader`/`SiteFooter`, so it
  reads as part of the site. 32 links, was 0.
- **`app/app/not-found.tsx`** (new) — renders **inside `AppShell`**, so a signed-in
  user keeps the sidebar, the command palette and their session.
- **`app/app/[...rest]/page.tsx`** (new) — catch-all that calls `notFound()`.

The catch-all is the subtle one, and it was found by the probe failing rather than by
reading. Adding `app/app/not-found.tsx` alone changed nothing for unmatched `/app/*`
URLs: a URL matching no segment renders the **root** `not-found.tsx`, so a signed-in
user who mistyped a deep link was ejected out of the app into the *public marketing
shell*, offered only "Back to homepage" and a fresh login. The catch-all matches the
segment, so `notFound()` resolves to the app's own boundary. Static and dynamic
segments outrank a catch-all, so every real route still resolves to its own page.

Both boundaries carry `data-page-status="not-found"`, matching the markers already used
by `forbidden.tsx` and `error.tsx`. That matters: those markers exist because a page
that renders *at* the requested URL instead of redirecting is otherwise scored as a
clean page. A 404 with no navigation is exactly that shape.

**The assertion that actually protects this is "the way out works", not "a 404 renders".**
`qa-probe-not-found.mjs` clicks "Back to dashboard" and asserts it reaches a live page
(200, lands `/app`, `h1` "Overview"). A 404 linking to another 404 is still a dead end,
and a page-visit sweep scores both identically. 18/18 — evidence at
`docs/evidence/not-found-check.json`.

**This probe also caught itself passing a false positive, which is worth recording.**
Its first version asserted the app 404 "renders inside the app shell" by counting
`nav a[href]` — and got 17. It was reading the **marketing** `SiteHeader`, because that
is also a nav full of links. The count was real and the conclusion was wrong: the app
404 was not being used at all. The check now discriminates on content — the app's own
`a[href="/app"]` recovery link present, **and** the marketing footer absent. Same lesson
as the Tuko role sweep: an assertion whose selector also matches the wrong thing
produces confident, plausible, wrong output rather than an error.

**Side effect worth stating: everything under `/app` serves its not-found page with
HTTP 200, not 404.** This is pre-existing and is *not* caused by the catch-all — the
record-not-found path returned 200 before any of this. Cause is a controlled
comparison, not a guess: `(marketing)` has no `loading.tsx`, and `/resources/<bad-slug>`
calls the same `notFound()` and correctly returns **404**. `app/app/loading.tsx` puts a
Suspense boundary above every app page, so the response starts streaming, the status is
committed as 200, and the later `notFound()` cannot change it.

Left as-is deliberately. Removing `loading.tsx` would buy a correct status code at the
cost of the slow-TLS hang those files exist to prevent; `/app` is `noindex, nofollow`,
so no crawler is affected; and the page a user sees is correct. Only monitoring would
read a soft-404 as a success. The probe records it in an `observations` array rather
than dropping the check, and §6 tracks it.

### P2 — Confirm dialogs dumped keyboard focus onto `<body>` when they closed. Fixed.

`ConfirmDialog` guards **21 mutations** — ticket status, payroll approval, CRM stage,
leave approval, hiring conversion, CMS status, attendance corrections. It opens with
`showCloseButton={false}`, so Cancel is the only visible exit, and nothing in the
existing suite touched focus at all: the role sweep visits pages, the workflow
exercises drive buttons with the mouse. Focus behaviour is invisible to both.

Measured on a real ticket, not inferred. Closing the dialog left
`document.activeElement === BODY`, so a keyboard user who cancelled a status change
was thrown to the top of the document and had to Tab all the way back to the control
they came from.

**Cause.** Base UI restores focus to its `Dialog.Trigger`. This dialog has no trigger —
it is opened by React state from a `<select>`, a table-row button, a menu item — so
there was nothing registered and it fell back to `<body>`.

**Fix.** Pass a *function* to `finalFocus`, returning the element to return to. The
function form is the load-bearing part, not a stylistic choice: reading
`FloatingFocusManager`, a plain boolean resolves the target from the library's own
"previously focused" stack, which by close time holds the **Cancel button** (focus
moves into the popup immediately), and that element is unmounted by the time the
restore runs. A function sets `hasExplicitReturnFocus`, which skips that lookup.

The trigger is captured by listening for `focusin` **and** `pointerdown` while the
dialog is closed. The second listener is not belt-and-braces: Safari does not focus a
`<button>` on click, so without it every mouse user on Safari loses their place, and a
Chromium-only test run would never show it.

`qa-probe-dialog-keyboard.mjs`, **16/16**, evidence at
`docs/evidence/dialog-keyboard-check.json`. Strictly read-only — it never clicks
Confirm, and asserts the ticket status is unchanged at the end.

#### The first four rounds of this were wrong, and the wrongness is the useful part

This defect was reported as **half-fixed** and written up with a specific upstream root
cause: that Base UI's `closeOnFocusOut` branch sets `preventReturnFocusRef.current =
true` and suppresses return focus on the Escape path (`FloatingFocusManager.js:591`).
Escape failed; Cancel passed; every caller-side restore was tried and none fired. That
is a coherent story and **none of it was true.**

Two separate mistakes, both worth naming:

**1. The diagnosis was read out of the wrong branch.** Line 591 sits inside
`else if (portalContext?.portalNode)`, which is only reached when `modal` is **false**.
`DialogRoot`'s `modal` defaults to true, so a modal confirm dialog never executes that
line. I had the mechanism right and the branch wrong, and stated it with a file and
line number — which is exactly what makes a wrong diagnosis expensive: it sends the
next person to the wrong line *with confidence*.

**2. The instrument was broken, and it looked like a keyboard-specific library limit.**
Instrumenting `finalFocus` showed it was called on **both** paths with the correct
`closeType` (`"keyboard"` for Escape, `"mouse"` for Cancel) — and that the callback
returned `null` on Escape because `returnFocusTo.current` was null. The probe was
moving focus to the `<select>` **before React had run the effect** that registers the
capture listener, so the very first `focusin` was missed.

That also self-propagated. The failed Escape left focus on `<body>`, so the later Cancel
case ran on a warm page and inherited the earlier capture — it was never proving
anything on its own. Re-running each close path in a **fresh browser context** with a
short settle before the first interaction passes both.

The general lesson is the same one recorded twice already in this report, and it keeps
earning its place: **a check whose selector or timing is wrong produces a confident,
specific, entirely fabricated finding.** This one produced a fabricated *root cause*,
which is a more durable error than a fabricated bug because it survives being correct
about the symptom. Before blaming a library, confirm the callback you are instrumenting
actually receives what you expect.

Three of the probe's own checks were also wrong before any of this was true, and each
produced a confident false finding:

- *"`aria-modal` is missing"* — Base UI hides the page behind the dialog with
  `aria-hidden` on the app container rather than `aria-modal` on the dialog. The
  equivalent, and what a screen reader honours. Fixed to assert the isolation that
  actually exists.
- *"Tab escapes the dialog"* (twice, forward and back) — Tab lands on a **focus guard**
  that Base UI renders immediately outside the popup, which then bounces focus back
  in. The measured cycle is Cancel → Update status → guard → Cancel. A guard is the
  mechanism a working trap is *built from*; counting it as an escape manufactures a
  finding. The check now asserts the **round trip** — after tabbing past the last
  control, focus must come back inside — which a genuine leak never does.

A fourth one is worth keeping too: the probe initially asserted "inside the app shell"
by counting `nav a[href]` and passed with 17, while reading the *marketing* header. See
the 404 section above, and note it is now the second time this project has produced it.

### Coverage added, no defect found — the ⌘K command palette

The palette is the app's primary navigation affordance: the header advertises it with
a literal `⌘K` hint, so every user is told to reach for it. Nothing drove it. The role
sweep visits pages; the link crawl reads `a[href]`; and the palette renders **none** of
those, because cmdk builds its items at runtime from the permission set. A palette that
opened but could not be typed into, could not be arrowed, or could not be left with
Escape would pass every existing check.

`qa-probe-command-palette.mjs`, **11/11**, evidence at
`docs/evidence/command-palette-check.json`. It drives the real thing end to end —
Ctrl+K opens it, focus lands in the search input, typing filters 35 items to 3, Enter
lands on `/app/my/attendance`, the palette closes itself, and Escape returns focus to
the exact link that was focused beforehand (`A → /app/tickets`, not `<body>`).

It also asserts the **permission contract**: `getCommandLinks` must not offer an
employee a route the owner's palette does not have. Owner sees 35 targets, employee 11,
and the employee's set is a strict subset — the check records any employee-only link
into `observations` rather than silently allowing it, because a palette that advertises
a route the user cannot open is a lie told by the navigation itself.

No defect found here. This entry is in the report anyway, because *"we now have a check
that would catch it"* is a result worth being able to point at, and because the next
person should not have to re-derive that this surface was untested.

### P2 — The notification bell hid its unread count from screen readers, and its badge failed contrast. Fixed.

The bell is how a user learns something needs them, and it is the app's other primary
daily interaction. Two defects, both invisible to every other check here — the role
sweep records "0 console noise" and moves on, the link crawl reads `a[href]` and sees
neither.

**1. The unread count was never announced (WCAG 4.1.2 Name, Role, Value).** The badge
is a `<span>` inside the button, but the button carries a **static**
`aria-label="Notifications"`. `aria-label` overrides descendant content, so a screen
reader announced "Notifications" and nothing else — a bell with 1 unread and a bell
with 9+ were indistinguishable. Measured before the fix: badge rendering `9+`,
`aria-label` reading `Notifications`.

**2. The badge failed WCAG AA contrast.** White on the brand green `#119446` measures
**3.93:1** at 10px bold. Small text is never "large text" however bold it is, so the
4.5:1 threshold is the one that applies. Measured from computed styles in the page,
not read off the class names, so a theme change cannot silently invalidate it.

Both fixed, and the second fix is the one worth reading twice: `globals.css` already
had the right token and already said so —

```css
/* Interactive/text green darkened for WCAG AA 4.5:1 on white; brand #119446 kept for accents */
--color-green-strong: #0b6e34;
```

The badge had reached for `green` where the design system says accents belong. Switching
to `green-strong` measures **6.37:1**. The defect was not a missing colour; it was a
documented rule about which colour is for what, ignored at one call site.

`qa-probe-notification-bell.mjs`, **10/10**, evidence at
`docs/evidence/notification-bell-check.json`. It is read-only by design — it does not
click a notification, because that marks the row read and navigates.

**And the probe's own first post-fix run failed, correctly, for a reason worth
recording:** the final assertion compared the returned focus label to exactly
`"Notifications"`. Once the count moved into the name the label reads
`"Notifications (12 unread)"`, so the check reported a regression that was actually the
fix landing. A check that goes stale when the thing it checks is **improved** is its own
kind of wrong — it manufactures a defect out of a remedy — and it is the mirror image of
the false passes documented above.

### The responsive audit could not be aimed at the production build

`audit-app-responsive.mjs` exists, covers the authenticated `/app/*` surface at eight
viewports, and reads the same `data-page-status` boundaries this report keeps insisting
on. It was simply never runnable against the server this pass uses:

```js
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
```

3000 is the **dev** port. Run against a `next start` build on 3100 — which is where every
other probe in `scripts/audit/` points — it failed immediately with
`ERR_CONNECTION_REFUSED`. That failure looks like a broken application, not a misaimed
tool, which is why it is worth writing down: nothing in the output said "wrong port".

Both responsive scripts now read `QA_BASE_URL` first, matching every other probe in the
directory, keeping their existing argument/env var for existing callers, and defaulting
to the **production** port rather than the dev one.

**The full sweep then ran clean, but only because it was chunked.** All 28 default routes
× 8 viewports in one process reached **2.4 GB RSS and 20+ minutes** with no incremental
output, and took the application server down with it. Contexts are closed correctly
(`await ctx.close()` per combination), so this is Chromium accumulating across ~224
context create/destroy cycles, not a leak in the script. Run in four chunks of seven
routes it takes ~140 s each and stays flat:

| Chunk | Routes | Combinations | Result |
|---|---|---|---|
| 1–4 | 28 | **224** | **all clean, 0 failures** |

So the mobile surface — overflow, right-edge bleed, sub-44px touch targets, sub-16px body
copy, console errors, and boundary denials — is **224/224 across eight viewports from
iPhone SE to wide desktop**. The only cost of the audit is that it has to be run in
chunks; that is now documented in §7 rather than rediscovered by the next person.

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

### Hire workflow — `qa-exercise-hire-workflow.mjs`, 23/23

```
recruiter cannot hire  ->  HR moves stage  ->  HR hires  ->  employee + membership + role
```

`convertApplicantToEmployee` is the highest-consequence button in the product: it creates
an employee record, rewrites an applicant's membership into an internal one, replaces their
role, flips the application to `hired` and writes an audit row. This pass drives it through
the real UI as the role that is allowed to.

**It seeds its own fixture.** The seeded demo data has no `applicants` row for
`applicant@demo.beepabpo.com` — it has an auth user, an `applicant` membership and a
profile, but not the recruitment rows. Without a `profile_id` the action calls
`inviteOrResolveAuthUser`, which sends an email and is rate-limited here, so the hire path
could not be exercised at all. The pass therefore creates the `applicants` +
`job_applications` rows itself, against a real published `job_posts` row, and deletes both
in cleanup.

| Assertion | Result |
|---|---|
| Signed in as HR — the role that can actually hire | PASS |
| Applicant page loads | PASS |
| Signed in as Recruiter — the role that cannot | PASS |
| **The Recruiter page really is the Recruiter** | **PASS** — cookie identity asserted |
| **Recruiter does NOT see the Hire button** | **PASS** — absent, not failing |
| **Recruiter still sees the stage control** | **PASS** |
| **The HR and Recruiter sessions are separate** | **PASS** |
| Stage change asks for confirmation | PASS — `Move application stage?` |
| Stage moved to `offer` | PASS — `client_interview → offer` |
| `application_stage_history` recorded the move | PASS — `{client_interview → offer}` |
| Hire button visible to HR | PASS |
| Hire asks for confirmation | PASS |
| Employee record created and active | PASS — `BEE-000NN`, increments per run |
| Hired member has the `employee` role | PASS — `[employee]` |
| **No stale `applicant` role left behind** | **PASS** |
| Membership became `internal` and active | PASS |
| Application is now `hired` | PASS |
| Hire is audit-logged | PASS — `application.stage_update` + `application.hire_convert` |
| 0 console errors | PASS |
| **Recruitment left exactly as found** | **PASS** — incl. the `profiles` row |

**Separation of duties, now asserted rather than claimed.** The Hire button renders only
when `canAll(permissions, ["recruitment.manage", "employees.manage"])` holds. Recruiter
holds the first and not the second, so the button is **absent from the page** — not present
and failing on click. Recruiter *does* see the stage control, which is what makes the
absence meaningful: absent-Hire alongside present-stage is a permission boundary, whereas
absent-everything would just be a broken page.

This was previously written up here as *"asserted here so a future permission change that
quietly widens it will be noticed"*. **It was not asserted by anything.** The pass only
ever signed in as HR, so the claim was documentation asserting a control no test exercised.
It is asserted now, in its own `BrowserContext`.

The stage `<select>` opens a `ConfirmDialog`. Choosing a stage and moving on changes
nothing, and the open overlay then intercepts every later click — which is how the first two
runs failed, once as "stage did not change" and once as a Playwright "element intercepts
pointer events". The same ConfirmDialog rule that bit the leave and ticket exercises
applies to recruitment too.

The restore also had a real bug, caught by its own final assertion: it deleted roles the run
*added* but never re-inserted one the run *removed*, so a failed run left the account with
no roles at all. `qa-repair-applicant-membership.mjs` exists for the case where a killed
process never runs its `finally` at all.

**The fixture is deliberately named `Qa Hireprobe`, not `Demo Applicant`.** The action
rewrites the profile to `${first_name} ${last_name}`. A fixture named "Demo Applicant"
overwrites "Demo Applicant" with "Demo Applicant", so the profile-restore check passed
whether or not a restore had happened — it could not fail, and so proved nothing. A distinct
name makes the overwrite visible. `--skip-profile-restore` injects the fault on demand and
was run to confirm the check goes red: **22/23, with `profile=Qa Hireprobe … MISMATCH`.**

Cleanup is verified, not assumed. `qa-probe-hire-residue.mjs` is a gate (non-zero exit) over
the things a hire touches outside recruitment — the `profiles` row, the created employee,
the fixture rows, and `audit_logs` rows left pointing at a deleted application.
`qa-cleanup-hire-fixture.mjs` clears that residue, scoped by a marker no demo row carries
(`source = 'qa_hire_fixture'`) and, for audit rows, by **absence** — the `entity_id`
resolves to no live application, so real audit history cannot be in scope.

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
| `signupAction` | **Driven end to end** — real account + applicant membership created via the form, then deleted |
| `resetPasswordAction` | **Driven elsewhere, 8/8** — needs a *session*, not an inbox; see §5 |

**The anti-enumeration assertion was measuring the wrong element, and reporting an
environment ceiling as a defect.** It compared two strings pulled out of the page and failed
with `real="if an account exists." | fake="If an account exists for that email, we sent reset
instruction"` — which reads like a serious oracle. It was not.

Three separate instrument bugs, found in sequence:

1. **The fallback returned unrelated page text.** The extractor matched
   `/If an account exists[^.]*\./i` and, on no match, fell back to `text.slice(0, 200)` of the
   whole body. A real address hitting the 429 renders *"Too many password reset requests.
   Wait a minute, then try again."* in a `role="alert"` — which does not match — so the
   fallback returned the first 200 characters of the page, which happened to end `…if an
   account exists.` **A fallback that returns unrelated text is not evidence about the thing
   being tested.**
2. **`role="alert"` is not specific enough.** The toast host carries that role too and is
   *empty* when no toast fires, so the corrected version classified the fake address as
   `error` with empty text — a third spurious failure. Only alerts that carry text count.
3. **The discriminator was wrong.** The first attempt branched on
   `!/If an account exists/i.test(known)`, but both strings match that regex
   case-insensitively, so the branch never fired.

`qa-probe-forgot-password-enumeration.mjs` settles the underlying question by calling the API
the action calls:

```
real  hr@demo.beepabpo.com                        email rate limit exceeded
fake  qa-no-such-account-…@demo.beepabpo.com      no error
```

Supabase answers **silently-successfully** for an address with no account and only dispatches
mail for one that exists, so an exhausted budget surfaces as an error on the real address and
nothing on the fake one. The **copy** is identical on both paths when a send gets through —
which the sibling assertion confirms, and which still passes. So this is BLOCKED, not FAIL.

Stated plainly, because it is a real property and not a comfortable one: **while mail is
rate-limited, a caller can tell a real address from a fake one.** That is the documented cost
of a decision made deliberately in `15a5193` — surface a failed send as an ERROR rather than
mask it behind the success copy, so nobody waits on an inbox that will stay empty. Every
wording in `passwordResetErrorMessage` is delivery-failure wording and none of them mentions
existence, so nothing about *why* the send failed is disclosed. The oracle is the budget being
visible, and it closes when the budget is not empty. Recorded, not re-litigated.

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

`BLOCKED` is a distinct outcome from pass and fail, and it is used honestly here.
Supabase rate-limits outbound email in this environment, so signup account creation cannot be
re-run on demand — but it is a **budget, not a wall**, and once one call got through the
success path ran and passed (see §2). The script does not fold a rate-limited run into the pass
count and does not leave it permanently red either — it reports `BLOCKED` with its own exit
code, and separately proves the one thing that *is* provable under a 429, which is that the app
now says "Too many sign-up attempts from this network" instead of blaming the address.

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

### CMS workflow — `qa-exercise-cms-workflow.mjs`, 43/43

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

### P2 — Every filter on every internal and client list page is live

`qa-exercise-list-filters.mjs`, **35/35 on 27 pages across 3 roles**, 0 defects.

The action coverage in §5 counts server actions. It does not cover the other half of
a list page: the GET filter form. A filter can render, sit in a proper form, submit a
correct query string and then be **ignored by the query it was meant to reach** — the
page changes nothing and reports a confident, complete, wrong list. That is not
hypothetical: it is exactly what the NTE search box was (§2, P2), and the release
gate's "no dead controls" audit passed the whole time, because that audit can see a
control that submits and cannot see a query that ignores it.

Three roles are driven, each in its own browser context, because the cookie jar
decides which pages render at all: internal (21 routes, `owner`), client (8 routes,
`clientadmin`) and applicant (1 route, `applicant`). An earlier version ran only the
internal pass and printed the other nine routes as "not covered by this run" — which
left nine list pages whose filters **nobody had ever driven**, while the report read
as though the filter layer were covered. That is the same failure as the storage RLS
finding above: a gap that is visible only if you go looking for it is not closed.

Two invariants, chosen so neither has an escape hatch:

- **A search must respond to a string that matches nothing.** The run types a per-run
  marker that cannot occur in any seeded row and requires the result set to change.
  A search that returns the unfiltered list for a no-match string is dead.
- **A dropdown must be able to change something.** Selects have no no-match value and
  an option can legitimately return the same rows as "all", so the invariant is
  weaker but still falsifiable: *at least one* option value must produce a different
  result set. A dropdown where no option does anything is inert.

Plus guards that keep the result honest: a page whose unfiltered list is empty is
**skipped** for the dropdown leg (with no rows, no filter can change anything, and
reporting that as inert would be the same mistake pointed the other way), and a
dropdown with no effect is printed as a **candidate for confirmation against its
table**, never concluded to be a defect from the DOM alone.

`/app/approvals`, `/app/client/tickets` and `/app/client/timesheets` have no filter
form at all and are reported as such rather than skipped silently.

#### This script reported 14 dead filters. All 14 were the script.

That is worth recording in full, because the failure looked exactly like a product
defect and two of the named pages had been fixed and proven earlier in this same
session — `/app/hr/nte` above all, whose search box this report lists as **Fixed**.

Four harness bugs, all of the same family — a locator that looks right and is not:

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
4. **Waiting for the URL to stop moving is not waiting for the content.** A Next.js
   client-side transition updates the address bar **immediately** and streams the RSC
   payload afterwards, so "the URL has settled" says nothing about whether the new
   markup is on screen. Measured directly, the search that was reported dead works
   correctly — 5 job posts unfiltered, 0 plus the `No job posts` empty state filtered.

The fix is to identify the filter form **by its Apply button** and remove only that
one form. Nothing about the product changed; the run went from 14 reported defects to
zero, without touching a line of application code.

#### Widening the matcher to cover a documented variant matched the thing it was meant to exclude

After the client leg was added, `FilterBar`'s `showApply={false}` option — "omit the
Apply button (Enter still submits)" — would have made the script silently skip any
page using it. The first fallback accepted "a form containing a named `select`".

`/app/client/tickets` has **no filter form at all**, but its create form has
`<select name="priority">` and `<select name="category">`. The fallback drove the
create form and reported two defects on a page whose filters do not exist — the same
fourteenth-bug, one generation later.

The fallback now accepts only a form carrying a real FilterBar marker: the search
input, `name="q"` or `aria-label` beginning "Search". The shape this will miss — a
FilterBar with **both** `showApply` and `showSearch` off — does not exist today, and
is stated in the script header rather than papered over. **Under-detecting and saying
so is strictly better than matching the thing you meant to exclude**: a skipped page
is visible and costs coverage, whereas a wrong match produces confident invented
defects and costs trust.

The rule this earns, which is the same one the source-contract guards in this repo
keep re-learning: **before reporting a defect from a harness, prove the harness can
detect the thing it is looking for.** Both times here, a positive control on a page
already known to work — `/app/hr/nte` and `/app/tickets` — would have caught the
instrument before it produced a list of fourteen defects that did not exist.

### P2 — Every list offers "Next" on its last page when the page is exactly full. Documented, not changed.

`components/app/list-pager.tsx:39` decides whether a next page exists from the number
of rows on the page it is rendering:

```tsx
const showNext = rowCount >= pageSize;
```

`rowCount >= pageSize` cannot distinguish *"this page is full **and** there are more
rows"* from *"this page is full **and these are all of them**"*. At an exact multiple
of the page size the pager offers **Next**, the user clicks it, and lands on an empty
list reading "Page 2" with nothing on it and no explanation. There is no error, no
warning — the list simply ends one click too early.

The inputs make it worse, not better. Of the **47 `ListPager` call sites**, 46 pass the
current page's own row length:

```tsx
<ListPager page={page} pageSize={PAGE_SIZE} rowCount={notifications?.length ?? 0} />
```

which is only the shape needed to answer "is this page full?". One —
`app/app/client/timesheets/page.tsx`, which runs `count: "exact"` — passes a true
total (`rowCount={pendingReviewTotal}`) and is the correct shape everywhere else. It
still fails on the same boundary, because a total of exactly `pageSize` satisfies
`>=` too. So the off-by-one is not fixed by passing a better number; it is fixed by
comparing `>` against a total, or by not using a total at all.

No list in the seeded demo currently sits on a boundary — page sizes run 20 to 100 and
the per-user lists hold fewer rows than that — so this is **latent, not live**. It will
be reached by ordinary use: an employee accumulates exactly 20 leave requests, a
client's team hits exactly 30 documents, `/app/admin/audit` reaches exactly 112. The
`my/leave`, `my/cash-advances` and `client/timesheets` lists at `PAGE_SIZE = 20` are
the most likely to get there.

**Not changed, because the fix is 46 call sites and a judgement call about cost:**

- Fetch `PAGE_SIZE + 1` rows per page, slice for display, and pass
  `hasNext={rows.length > PAGE_SIZE}`. No extra query, one extra row per page, but
  every page's `.range()` and display path changes.
- Or add `count: "exact"` to each query and compare `total > pageSize`. Simplest per
  page, but it is a second round trip on every list in the product.

`ListPager` should also accept an explicit `hasNext` rather than inferring it, so this
cannot be reintroduced by a page that passes the wrong number. The one call site
already doing it right is the model.

### P1 — Every ticket notification sent clients and applicants to a page they cannot open. Fixed.

`createTicket` and `assignTicket` both hardcoded the **staff** queue route on the
notification they sent:

```ts
// lib/tickets/actions.ts — createTicket
actionUrl: `/app/tickets`,
// lib/tickets/actions.ts — assignTicket
actionUrl: `/app/tickets/${parsed.data.ticket_id}`,
```

Both routes are guarded by `requireInternal`. The recipients, however, are almost
never staff: `createTicket` notifies **the person who raised the ticket**, and
`assignTicket` notifies **the assignee**, which can be a client-side user. So the
notification inbox's one link led to a perfectly laid out page whose entire content is
"Access not allowed".

Measured in the demo data before the fix — **6 notifications held by a non-internal
recipient pointed at a route they cannot open**:

| type | action_url | recipient |
|---|---|---|
| `ticket.created` ×3 | `/app/tickets` | 2 clients, 1 applicant |
| `ticket.assigned` ×3 | `/app/tickets/{id}` | 3 client-side assignees |

**Fix:** `lib/notifications/ticket-route.ts` resolves the route from the recipient's
`membership_type` (`internal | client | applicant`) — internal → `/app/tickets`,
client → `/app/client/tickets`, applicant → `/app/applicant`. `assignTicket` looks the
assignee's membership up rather than assuming it. The rule is pure string work over an
enum, so it is unit-tested without a signed-in actor or a working SMTP provider — the
same reason the admin invite fix lives in `lib/admin/role-assignment.ts`. The six rows
the old code had already written are data, not behaviour, and a code fix cannot reach
them; `qa-repair-notification-routes.mjs` repoints them and is idempotent.

**Applicants get `/app/applicant`, not a ticket list — and that is the honest answer.**
The first version of this fix sent applicants to `/app/my/requests`, which *exists* and
lists a user's own tickets by `requester_user_id`. The unit test passed, because it
checked the file was there. The link crawl then caught it:

```
requested /app/my/requests -> landed /app   (renders "My Applications")
```

The whole `/app/my/*` tree is behind the employee shell, so an applicant is redirected
to `/app` — their home, which shows applications, not tickets. The fix would have
traded a dead end for a redirect that *implies* they can track the ticket and then
does not show it. **There is no applicant-facing ticket surface in this product.**
Giving applicants one is a product decision; until then the notification points where
they actually are. The test now asserts this specific mistake directly, because a file
existence check is not an access check.

### P2 — Signing up with an address that already has an account reports "Account created". Fixed.

Found while probing the 429 blocker, not by driving the UI — which is itself the
point: this is the one part of `signupAction` that does not need the rate limit
cleared to observe.

Supabase deliberately does not reveal whether an address is registered. Measured:

```
auth.signUp({ email: "owner@demo.beepabpo.com", ... })
  -> NO ERROR, data.user.id = aeee9a93-4412-49e6-af34-2270c1c13d1c

admin.deleteUser("aeee9a93-…")  ->  "User not found"
auth.admin.listUsers()          ->  13 users, 0 duplicate addresses,
                                    owner@demo.beepabpo.com still exactly one
```

**No account was created.** The returned id belongs to no real auth user — GoTrue hands
back a placeholder rather than saying "already registered". Verified afterwards by
listing every auth user: no duplicates, no leftover probe accounts, and the real owner
account intact.

`signupAction` cannot tell the difference:

```ts
const { data, error } = await supabase.auth.signUp({...});
if (error) return { ok: false, error: signupErrorMessage(error) };
if (data.user?.id) await assignApplicantMembership(data.user.id);
return { ok: true, message: "Account created. Check your email to verify before signing in." };
```

No error, and `data.user.id` is set — so a returning user is told their account was
created, when nothing was created and no email will arrive. The
`assignApplicantMembership` call then tries to insert a membership for a profile id
that does not exist; it is wrapped in `try { } catch { }`, so it fails quietly.

**This is a genuine trade-off, not a bug to fix quietly.** Supabase's silence is
correct — telling someone "that address already has an account" leaks account
existence. The product's copy is what overclaims. The options are to send the neutral
message already used by `forgotPasswordAction` ("If an account exists for that email,
we sent reset instructions"), or to surface Supabase's own wording. Either is a
product decision about how much account existence the signup form reveals, which is
why it is documented rather than changed.

It also means `signupAction`'s *success* path is only fully honest in the case where
an account really was created — which is exactly the case the 429 currently prevents
anyone here from reaching.

**Fixed.** The owner chose anti-enumeration wording, and `signupSuccessMessage()` now
reads *"If that address wasn't already registered, we sent a verification link. If it
was, sign in instead."* The second clause matters: without it the message still tells a
taken address to wait for an email that will never arrive, which is the original bug
with better manners.

The helper takes **no arguments**. There is no status, user object or flag for a caller
to branch on, so it cannot be turned into an existence oracle by a later edit — adding a
parameter is the change that has to argue for itself. The assign step is left alone,
with a comment saying why: a present id is not evidence of a created account, and
treating a phantom id as a failure would rebuild the oracle this branch exists to avoid.

`qa-exercise-signup-workflow.mjs` now asserts the stronger property rather than the
weaker one: both submissions take the same code path, so the already-registered address
must produce **byte-identical wording** to the genuinely-new one. Divergence would mean
the form had become an account-existence oracle.

### P2 — `forgotPasswordAction` discards its error, so a 429 is reported as success. Fixed.

`lib/auth/actions.ts:248`:

```ts
await supabase.auth.resetPasswordForEmail(parsed.data.email, {
  redirectTo: authCallbackUrl("/reset-password"),
});

return { ok: true, message: "If an account exists for that email, we sent reset instructions." };
```

The error is not destructured, so it cannot be read. During this session
`resetPasswordForEmail` answered **429 on one call and no error on the next**, and the
action reported success in both cases. While that copy is a correct anti-enumeration
pattern, the *rate-limit* case is not enumeration — it is a delivery failure the user
is told did not happen. Worth distinguishing from "this address is unknown"; not
changed unilaterally, because the fix is a copy decision.

**Fixed.** The owner chose anti-enumeration wording, and `forgotPasswordAction` now
destructures the error and returns an **error state**, not success-with-different-copy.
Two reasons, and the second is the one that matters:

- The defect is precisely that `ok: true` asserted something that did not happen. Only
  `ok: false` restores that distinction, and the form renders it differently from the
  confirmation panel.
- **It is safe, and the success alternative is not.** An unknown address is not an error
  in Supabase at all — `resetPasswordForEmail` succeeds silently for one and falls
  through to the untouched "If an account exists for that email" copy. Every error
  reachable here is therefore a delivery or infrastructure failure, which is independent
  of whether the account exists. A genuine error carries **zero** information about
  existence. Keeping success-with-different-copy would leave a green confirmation panel
  on top of a failed send, which is the thing the user has to be protected from.

`passwordResetErrorMessage()` joins `authErrorMessage` and `signupErrorMessage` behind a
shared `authFailureKind()` classifier, so "429 is a rate limit, 0 and 5xx are the service,
everything else is the request" is decided once. A fourth mapper cannot be added with a
fourth reading of a status the other three already agree on.

### P3 — `/reset-password?token=…` rendered a password form that could never be submitted. Fixed.

`ResetPasswordForm` gated on **either** a token in the URL **or** a recovery session:

```tsx
if (!token && !hasRecoverySession) { /* "Invalid link" */ }
```

But `resetPasswordAction` never reads the token. It calls `getUser()` and returns *"This
reset link is invalid or has expired."* when there is no user. So a bare `?token=` was enough
to render a complete, credible **"Choose a new password"** form — two password fields, a real
button, no warnings — whose submission could only ever fail. The person types a new password
twice, presses the button, and is told the link is invalid.

Measured, not inferred. `qa-exercise-reset-password.mjs` opens `/reset-password?token=…` with
no session and reports the form rendered; submitting then returned `REFUSED`.

**Fixed** by gating on the session alone, which is the only thing the action accepts. The
token is still submitted as a hidden input; the action simply never needed it. The token was
never a live path anyway: `forgotPasswordAction` redirects to
`/auth/callback?next=/reset-password`, the callback exchanges the PKCE code, and redirects to
`/reset-password` with a session and **no** token. The branch only ever described a state the
product cannot produce, and turned a stale or hand-edited link into a dead end.

The exercise now asserts the corrected behaviour, so re-widening the gate turns it red.

### `cms.manage` was held by exactly one role, and that role could edit the website alone. Fixed.

The permission sweep found that `cms.manage` — which gates every write to `services`,
`industries`, `testimonials`, `case_studies`, `blog_posts`, `faqs`, `site_settings` and the
`marketing-media` bucket — was granted to `marketing` and **nothing else**. Not `owner`. Not
`super_admin`.

That is not least privilege, it is a **single point of failure with no recovery path**. If the
marketing seat is vacant — resigned, disabled, or never filled — then nobody can correct the
public website. Not the owner, and not via `system.manage`, because `has_permission()`
resolves through role grants and no such grant exists. The outage would be silent until
somebody tried to publish a correction.

`20261012010000_cms_manage_admin_recovery.sql` grants it to `owner` and `super_admin`.
**`marketing` keeps it** — this is redundancy for the administrator, not a reallocation, and
the grant matches what `owner` already holds for every other business domain. Verified after
applying: `cms.manage` is held by `marketing, owner, super_admin`, and `super_admin` moves
from 21 to 22 permissions.

The migration carries a `DO` block that **raises** if either role code or the permission is
absent. Without it the insert would match nothing and report success — a quiet no-op, and the
same shape as `hire-workflow` reporting "no published job" for a table that never existed.

**Verified in the product, not only in the database.** `qa-inspect-super-admin-gaps.mjs`
proves the grant exists by reading `role_permissions`; that is the data layer. The CMS
exercise now also signs in as **owner** and asserts it reaches `/app/cms` and is shown the
seven creation forms — because a grant can be applied and still be inert, if the page checked
a different code or the nav hid the link. It passes: `creationForms=7`.

**The grant invalidated a test, which is how it was caught.** `qa-exercise-cms-workflow.mjs`
had a negative case — "a user WITHOUT `cms.manage` sees no CMS content" — signed in as
**`owner@demo.beepabpo.com`**, chosen for exactly that reason: owner was the most privileged
role that *lacked* the permission. The re-run reported 41/42.

That is not a regression. It is the change working, and the test was asserting a state that
is deliberately no longer true. The negative case moved to **`hr`**, which is still heavily
privileged and genuinely without `cms.manage` — a stronger test of the boundary than the
bottom of the role list would be. Now **43/43**, and both directions are asserted:

| Role | `cms.manage` | Expected | Result |
|---|---|---|---|
| `marketing` | yes | manages content | PASS |
| `hr` | no | refused | PASS — `creationForms=0` |
| `owner` | yes (new) | manages content | PASS — `creationForms=7` |

**A note on the wider permission picture, measured after the fix.** `permissions.manage` is
now the **only** permission in the system held by exactly one role (`super_admin`) — the same
single-seat shape `cms.manage` had. It is left as a product decision and flagged, not changed:
it is a platform power, `super_admin` is the platform role, and giving `owner` it would blur
the platform/business split drawn on purpose above. But if that one seat is ever emptied,
nobody can grant a permission to anybody. Every other permission is held by at least two
roles, and 0 permissions are held by nobody.

### The payroll exercise was not self-cleaning, and its own green sheet could not tell

Three runs left **15** dangling `audit_logs` rows behind — not the 3 this report previously
carried, because that count had only ever included `payroll.recalculate`. The others were
`payroll.period.create`, `payroll.period.submit_approval` and `payroll.period.approve`, all
pointing at a `payroll_periods` row the exercise created and then deleted.

The reason nobody noticed is the important part. The exercise's final assertion compares
three counts — periods, records, payslips — and **not one of them moves when an audit row
leaks**, because the leaked row is a new row in a table nobody was counting. A tally cannot
fail on a value it does not measure.

The first fix deleted audit rows by entity type, looking up the run's `payroll_records` to
find `payroll_record` audit ids. That lookup returned **nothing**, though records for that
very period existed and were deleted correctly two lines later — and one `payroll.recalculate`
row leaked anyway, which is how the failure was caught. Reasoning about which entity types a
run *can* write is a guess; the set of rows that existed before the run started is a fact.

So cleanup is now scoped by **snapshot**: `AUDIT_IDS_BEFORE` is captured at module load, and
cleanup removes exactly the audit rows not in that set. No entity-type allow-list, no date
heuristic, and no way to touch seed or pre-existing history. The run's own check gained an
`audit` count so the leak would be visible even if cleanup broke. Last run:
`cleanup: 6 audit row(s) this run created, deleted`, `audit 1->1`, **19/19**.

`qa-cleanup-payroll-audit.mjs` cleared the historical 14. One dangling row is **kept**: it
predates the audit effort (2026-09-22) and is seed provenance recording that a period was
created during seeding. A cleanup rule written to remove test residue does not get to delete
real history.

### Link crawl — `qa-exercise-internal-links.mjs`, **29/29**

Every control so far was proven by asserting on **rows it changed**: a filter that
narrows a list, an action that writes. Nothing had ever checked the other half of a
link — that it **resolves**. A link to a renamed route, a deleted record, or a page
behind a permission the current role does not hold all render perfectly and then take
the user somewhere they did not ask to go. The notification bug above is exactly that,
and it had survived the notifications pass, because that pass asserted on the
notification's **body** and never followed its **link**.

The run walks each role's reachable links from a seed set that includes list pages —
not just the nav, because the id-rot risk lives in the detail links inside rows, and a
nav-only crawl would find the sidebar and call it a day. **Four passes: internal (102
links), client (32), applicant (5) and the public marketing site (25).**

#### The standing 28/29 named the wrong table. Now 29/29.

This failure had been written up as:

> `/app/payroll/periods/42df33d5-…` (record no longer exists) — **audit history** for a
> deleted record; every QA run that creates and deletes a record leaves one

That was a guess presented as a finding, and it was wrong. When the payroll audit cleanup
finally removed the `audit_logs` residue, the link **survived** — so it had never been coming
from `audit_logs` at all.

`qa-probe-dead-payroll-link.mjs` asks the narrow question: does anything still reference that
one id?

```
target period: 42df33d5-f7b2-4194-8bc7-2ac75f4eead7  deleted
audit_logs (entity_type=payroll_period)        0
notifications (entity_type=payroll_period)     0
notifications (action_url contains the id)     0
approval_requests (entity_id)                  1   <- pending, 2026-10-10
approval_actions (via request)                 0
payroll_records                                0
```

It was a **`pending` `approval_requests` row**. The approvals queue renders a link from it,
the crawler follows it, the period is gone. Five such requests existed; only the `pending` one
was crawlable, which is why exactly one link ever failed. `qa-cleanup-payroll-audit.mjs` now
removes them under three constraints — the `payroll` workflow (**not** all 30 approval
requests, which would sweep in 23 leave and 2 cash-advance requests), an `entity_id` that
resolves to no live period, and a post-QA date.

**A first attempt at that probe produced confident nonsense**, which is the reason it is
worth recording. Asked broadly — "which rows reference a deleted payroll period?" — it
answered *"62 of 62 notifications"* and *"30 of 30 approval requests"*. Both were its own
fault: a `__none__` sentinel was compared against the live-id set, so every notification with
a `/app/tickets` or `/app/leave` URL counted as a hit; and every `approval_requests` row was
compared against live **payroll period** ids, so leave requests and cash advances — different
entities entirely — all counted as dead. That is the same error as comparing `payroll_record`
ids against period ids, which nearly made live audit history look safe to delete. **A survey
across entity types invites exactly that mistake; an exact-match probe on one id cannot.**

The link crawl had already been skipping `/app/reports/export` as a download endpoint — worth
noting because `audit-role-sweep.mjs` was counting that same route as a page error at the same
time. Two crawlers, one correct, one not.

Four things are judged, all by where the link **lands**, never by whether it has an
href:

1. **No 404.** A Next.js 404 renders "This page could not be found".
2. **No dead end on "Access not allowed".** Next's `forbidden()` renders *at* the
   requested URL rather than redirecting, so the obvious test — "did this bounce to
   /login?" — cannot see it at all. A 403 page is laid out cleanly, so it looks like
   success. This repo already solved that: `forbidden.tsx` carries
   `data-page-status="forbidden"` for exactly this reason (`docs/CHANGELOG.md`,
   "The responsive auditor scored a 403 as a perfect page"), and this run reads the
   marker rather than sniffing for the words. That single change is what turned the
   notification defect from invisible into a FAIL.
3. **No redirect somewhere else**, and no page error.
4. **No link to a record that no longer exists** — reported as its own class, because a
   404 on a *route* is a product defect while a 404 on a *record id* is a reference to
   something since deleted, and conflating them lets the first hide behind the second.

**Positive control, or the crawl proves nothing.** A crawler that matches zero anchors
reports a clean sheet. The run asserts it discovered a plausible number of links per
role (40 / 15 / 2) and a shortfall is a hard failure, not a note. Before trusting the
detector at all, it was driven against three known cases: a bogus route (flagged 404,
`h1` = "404"), a known-good dashboard and a known-good ticket detail (neither flagged),
and a client opening an internal-only route (correctly landed on the forbidden page
rather than `/login`, which is what taught the run to read `data-page-status`).

**Result after the fix: 20/21**, with the client and applicant legs fully clean. The
one remaining failure is honest and is **this report's own residue**, not a product
defect:

> `internal — no link points at a record that no longer exists`:
> `/app/payroll/periods/42df33d5…`

All three `payroll_period` ids referenced by `audit_logs` are stale: the payroll
exercise creates a period, writes three audit rows, then deletes it. The audit page
faithfully renders history for a record that no longer exists, which is what an audit
trail is for. Deleting audit rows to turn a check green would be the wrong trade, so
it is left visible and reported, and **every run of the payroll exercise adds one** —
a cleanup gap in that harness worth closing separately.

This is also why the failure is reported as its own class rather than lumped in with
404s: had it been folded into "broken links", the one genuine product defect in this
whole pass would have been filed next to three rows of my own mess.

A download endpoint (`/app/reports/export`) is not a page — Playwright aborts the
navigation with "Download is starting" — and is skipped and named, rather than counted
as a broken link. An earlier version counted it, which would have been a fourth
invented defect from the same script that had already produced three others.

#### The public marketing surface was excluded on a bad reason

The first version of this run declared the public site out of scope because *"the
contact-form pass covers it"*. That pass covered the contact **action**. It had never
followed a single marketing link, and the **sitemap — which advertises CMS-built
detail URLs to search engines — had never been requested at all**. A slug that no
longer resolves would have been advertised and unnoticed.

The public pass found the surface **healthy**, and the checks are worth stating
because they are the ones that would have caught a CMS regression:

| Check | Result |
|---|---|
| Every link reachable from the 12 public seeds | **25 links, all resolve** |
| Every URL in `/sitemap.xml` | **22 URLs, all resolve** (18 on the stale build this was first measured against — see the correction below) |
| Header/footer nav present on every marketing page | 10/10 |
| `/login` reachable | from all 10 marketing pages |
| `/signup` reachable | from `/careers` only — which is the right design: applicants register from the job they applied for |

**CORRECTION (later in the same session).** This paragraph originally read that `/careers`
links five CMS-built slugs (`/careers/hr`, `/careers/payroll`, `/careers/support`,
`/careers/quality`, `/careers/customer-support-specialist`) "while the sitemap lists only
one of them", and concluded that five pages were reachable by link and invisible to search
engines. **That was wrong, and it was my measurement that was wrong, not the product.**
All five are listed. The sitemap that produced the "only one" reading was a *stale build
artifact* — see "The sitemap findings below were a measurement error" immediately after.

The lesson is recorded here rather than quietly deleted, because the wrong conclusion was
reasonable and defensible from the evidence available at the time, and because deleting it
would leave the next person to re-derive it.

### The sitemap findings below were a measurement error

An investigation was run to test a specific, plausible hypothesis: `/sitemap.xml` is a
metadata route that Next prerenders at build time, and `revalidateCmsPublic()` in
`lib/cms/actions.ts` revalidates seven paths — `/app/cms`, `/resources`, `/services`,
`/about`, `/contact`, `/case-studies` — **not** `/sitemap.xml`. The prediction was that
archiving a published article would drop it from the index and 404 its URL while the
sitemap kept advertising the dead URL until the next deploy.

**The prediction was never demonstrated, and the defect it pointed at does not exist.**
Three runs failed, and each failure was a different measurement mistake:

1. **The restart served the old build.** `next start` could not bind while the previous
   process still held port 3100, so the "rebuilt" server silently continued serving the
   build from before. Fixed by asserting the serving PID *changed* after every rebuild, and
   by throwing if the port did not actually release. This is why a measurement can look
   like it passed a control and still be reading the previous run's output.
2. **Even with the PID proven to change, the result was still wrong.** The probe had a
   positive control — publish a post, rebuild, assert the fresh sitemap *contains* it —
   and that control failed twice, which is why the script aborted instead of reporting a
   finding. The control was right and the run was wrong.
3. **The real cause: `next build` is incremental, and it does not regenerate every
   prerendered artifact.** `.next/server/app/sitemap.xml.body` was rewritten on every
   build — new mtime, `✓ Compiled successfully`, a fresh `○ /sitemap.xml` line — with the
   **previous build's content**. Every one of those signals looked like proof of a fresh
   render, and none of them was. `rm -rf .next` followed by the identical build produced a
   completely different and entirely correct sitemap.

What the clean build settled, with the probe row still present and published:

| | stale incremental build | clean build |
|---|---|---|
| `<loc>` entries | 18 | 23 (with the probe post) |
| freshly published post listed | no | **yes** |
| `/careers` slugs listed | 1 of 5 | **5 of 5** |

The row was confirmed visible to the exact anon query `app/sitemap.ts` runs, so RLS was
never the explanation, and the DB query itself is correct — `app/sitemap.ts` filters all
three tables on `status = published` and does return CMS-built content.

**What survives, and what does not.** The code-level observation is still true and still
worth knowing: `/sitemap.xml` is served as a build-time static route and nothing in the CMS
actions revalidates it, so on a real deployment a newly published article will not reach
the sitemap until the next deploy. That is an SEO-freshness gap, not a broken page, and it
is a genuine (low-severity) design observation. What does **not** survive is any claim that
archiving an article leaves a dead URL advertised in the sitemap — that was predicted, never
observed, and the prediction is now refuted.

The generalisable rule, which cost three runs to learn: **anything Next prerenders at build
time must be measured after `rm -rf .next` and a full rebuild.** A new mtime on a build
artifact is not evidence that the artifact was regenerated.

`qa-exercise-sitemap-unpublish.mjs` is retained in the repository. Its control did its job —
it refused to let an ungrounded finding through — even though the bug it was hunting was
not a bug.

`/login` and `/signup` are seeded explicitly rather than followed from the marketing
pages, because links that appear only *on* those pages — `/forgot-password` from the
sign-in form — are otherwise discovered by nothing at all.

### P2 — The release gate was not reliably green, and its failures were load artefacts. Fixed.

This report had claimed **18/18 "All checks passed. Ship it."** after every batch for
most of the session. That claim was true of the runs it was made about, and it stopped
being true of the gate as a property. Three consecutive runs failed on **three
different tests**, none of which had anything to do with the changes in flight:

| Run | Failed step | Real cause |
|---|---|---|
| 1 | Vitest — `push-notification-flow` | 5s timeout on a test that is otherwise fine |
| 2 | Vitest — `nav-active` "scales linearly" | ratio measured **411.9** against a ceiling of 400 |
| 3 | Vitest — `encoding-integrity` "contains no UTF-8 mojibake" | **5s timeout**, not a mojibake finding |

The third is the one worth dwelling on, because I misread it first. The console
summary names the test that was *running* when the clock expired, so the report read
"mojibake found in the repo" — and a scan of all 642 scanned files found **zero**. Only
running vitest with `--reporter=json` and reading `failureMessages` exposed the actual
message: `Test timed out in 5000ms`. **A timeout in a test whose name is an assertion
reads exactly like a failure of that assertion.** That is the same failure mode as
`.first()` matching the create form: a plausible-looking reading that the evidence does
not support.

Two real causes, both fixed:

**1. The encoding test reads every tracked text file twice on Windows/OneDrive.** ~640
files of synchronous I/O, with the file list built at module load so the first test
pays for the walk too. Under vitest's 5s default that is a coin flip. The budget is
now 120s. No assertion was weakened — none of these tests is timing-related, so a
longer budget cannot make one pass that should fail.

**2. The nav scaling test divides by its noisiest sample.** It measures a *ratio*
(`largeMs / smallMs`), and the small operation finishes in microseconds, so it is the
one most likely to be interrupted by the scheduler. One preemption during the small
sample inflates the denominator and pushes the ratio over the ceiling — observed 406
and 411 against 400, on an algorithm that is linear. It now takes the **fastest of five
samples**, which is the measurement least contaminated by preemption. **The threshold
is unchanged at 400**, so a quadratic regression still measures ~40000 and is still
caught. This measures the algorithm rather than the scheduler; it does not relax the
gate.

The author of that test had already hit the same class of problem once before — the
comment records dropping `RUNS` from 2000 to 500 because the test had become "a load
detector". The fix stopped the *timeout* and left the *ratio* still load-sensitive,
which is why it kept coming back.

**One genuine intermittent remains, and it is not a test artefact.** The realtime step
subscribed, inserted a row, and received nothing in 60 seconds. Run immediately after,
the same probe delivered in **159ms** against a 15s budget. That is Supabase's
delivery, not this repo's code: subscribed, inserted, silent. The probe cleans up its
own row either way — verified, 61 notifications before and after a failed run — so a
miss costs nothing but a red gate.

Confirmed again during this batch: the realtime step failed under the full sequential
gate and passed in isolation at **290ms against a 15000ms budget**, then passed again on
the re-run that went 18/18. Same step, same code, three outcomes. That is a load
artefact, and it is the honest description of the gate's current state.

The honest position after this: **the suite is green, and the gate is green, but the
gate is not yet deterministic on a loaded machine.** Every earlier "18/18" in this
report should be read as "18/18 on that run".

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

### P2 — The client timesheet hand-off writes no audit trail at all. Fixed.

`lib/attendance/client-timesheet.ts` was the **only** module in this codebase whose actions
changed an approval status and contained **no `logAudit` call whatsoever**. Every other
action audited during this pass writes a row.

That matters more here than in most places, because this is the one workflow that crosses
the Beepa/client boundary with money attached: `submitTimesheetForClientReview` moves a
timesheet day into a client's queue, and `reviewClientTimesheet` is where the client
finalizes it or sends it back. After the round trip there was **no record of who decided
what, or when**.

It also has no approval trail in `approval_requests` — it is not driven through the
`advanceApprovalRequest` engine that the cash-advance and leave workflows use, so it was the
only cross-organisation approval in the product with no workflow record at all.

**Fixed**, after the regression sweep below surfaced it as the standing 13/14 on
`qa-exercise-client-timesheet-workflow`. The exercise had been asserting this rather than
assuming it was fine, which is the only reason it was still visible. Both sides now write:

- `attendance.client_review.submit` — before `supervisor_review`, after `client_review`
- `attendance.client_review.approve` / `.send_back` — before `client_review`, after the new status

Both record `entityType: "attendance_record"` and `entityId: record.id`, so both halves are
queryable from the one record, and both carry `before`/`after` so the row says what *changed*
rather than only that something did.

**A deliberate choice worth naming:** each row is written **after** its own update succeeds,
and the tests pin that ordering. An audit row claiming a transition that then failed is worse
than no row — it is a false statement in the one table whose whole purpose is to be trusted
when the facts are disputed.

Verified end to end: **14/14**, with *"the timesheet hand-off writes an audit row — 1 row(s)"*.

**Not fixed, and still open:** routing `reviewClientTimesheet` through the
`advanceApprovalRequest` engine, so the client's decision appears in `approval_requests`
alongside every other cross-organisation approval. That is a structural change to a flow that
works, not a QA pass's call.

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

#### A near-miss: this P1 was very nearly withdrawn on a truncated read

The owner was asked to choose between date-checking at submission and widening the client
view. While preparing that question I re-read the view, concluded it had **no** date
filter, and told the owner the P1 was a measurement error. That was wrong, and the way it
went wrong is worth more than the finding.

The view has three definitions across migrations. I read the one in
`20260906001300_query_rls_optimization.sql` and the search context was **truncated at
`and ea.status = 'active'`** — exactly one line before the filter. The current definition
in `20260907180000_client_timesheet_approval.sql` ends:

```sql
and (ea.start_date is null or ar.work_date >= ea.start_date)
and (ea.end_date   is null or ar.work_date <= ea.end_date);
```

So the original finding was right, and my refutation rested on a partial read presented
with more confidence than it deserved. What made it *nearly* wrong rather than merely
sloppy: the confirming probe I then wrote returned **0 hidden rows**, which is true and
which I treated as if it were evidence of absence. It is not — no demo record currently
falls outside the window, so the filter has nothing to hide. A probe that returns zero
because the condition is unexercised is not the same as a probe that returns zero because
the condition does not exist, and I did not distinguish them before reporting.

The rewritten probe compares the two populations directly — every attendance record
belonging to an actively-assigned employee against the rows the view returns — rather
than trusting a read of the SQL. It confirms the filter is present and reports that
nothing currently falls outside it.

Two rules, both the same rule as the sitemap one above: **a truncated context read is not
evidence of absence**, and **a probe returning zero is not evidence that the condition is
absent** until you have checked the condition is exercisable.

And a third, from the same fix going the other way: the guard's own tests assert on source
text, which catches a **missing** guard but not a **wrong** one. The first version
destructured `{ start, end }` from a row whose columns are `start_date` / `end_date`. Every
test passed — 622 of them — because the strings they look for were all present. `tsc` and
`next build` failed, and the gate read 16/18 for that reason alone. The commit was amended
rather than stacked, since nothing had been pushed. A source-shape assertion and a compiler
catch different bugs, and this codebase needs both.

So the guard was then driven for real rather than left at source-shape.
`qa-probe-timesheet-window-guard.mjs` seeds an attendance record inside the assignment
window and one ten days before it, clicks **Send to client** on each, and asserts 4/4:

| Assertion | Result |
|---|---|
| CONTROL: an in-window day still submits | PASS — "Timesheet submitted for client review.", status `client_review` |
| An out-of-window day is refused, naming the window | PASS — "This day (2026-08-26) falls before the employee's client assignment starts (2026-09-05), so the client would never see it." |
| The refused record was **not** written to `client_review` | PASS — `approval_status` unchanged at `supervisor_review` |
| The refused record is invisible to the client view | PASS — absent, as the view filter says |

The control is what makes the other three mean anything: without it, a broken button or an
invalid fixture would produce the same "refused" reading. The third assertion is the one no
source assertion could give — a guard placed *after* the update would pass every string check
and still leave the record in the client's queue.

Getting there took three failed runs, each fixed by dumping the page instead of guessing:
the fixture collided with `UNIQUE(employee_id, work_date)`; the attendance page is
**week-scoped**, so a fixture months back is invisible on the default week; and its default
view is a **heatmap** with no per-record button until `heatmap=0` is passed. The Date column
also renders as `Wed 26`, not `2026-08-26`. Every one of those would have been easy to
report as "the guard does not fire".

### Client timesheet workflow — `qa-exercise-client-timesheet-workflow.mjs`, 13/14 → **14/14**

The only workflow that crosses the Beepa/client boundary with a status hand-off. Both
actions exercised, **both directions of the review** — Approve (`finalized`) and
*Send back* (`supervisor_review`) — because only exercising Approve leaves the branch
that returns work to Beepa completely untested.

| Assertion | Result |
|---|---|
| A draft timesheet exists for a client-assigned employee | PASS |
| Internal user is offered *Send to client* for the day | PASS |
| **`submitTimesheetForClientReview` moves the record to `client_review`** | PASS |
| The timesheet hand-off writes an audit row | FAIL — no `logAudit` in the module · **now PASS, both sides log** |
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

**Does the client review belong in the approval engine? No — and the split is deliberate.**
`reviewClientTimesheet` writes no `approval_requests` row, which looked like an omission. It
is not:

- The engine's `ApprovalWorkflowCode` is `leave | attendance_correction | cash_advance |
  payroll`. There is **no** client-timesheet workflow, so routing this through
  `advanceApprovalRequest` would fail at `resolveActiveWorkflow` — there is nothing to
  resolve.
- The attendance record carries its **own** state machine, `timesheet_approval_status`
  = `draft → employee_review → supervisor_review → client_review → finalized`. The review
  is one transition in that machine, not a step in a configurable chain.
- The sibling action in the same domain proves the split is a decision rather than an
  oversight: `lib/attendance/corrections.ts` **does** create and advance an approval request
  (`attendance_correction`). A correction rewrites historical data, so it earns a multi-step
  chain; a routine periodic sign-off does not.

The one genuinely odd detail is that this action requires `approvals.act` while touching no
approval request. That reads as deliberate belt-and-braces — a client must hold an explicit
"may approve" grant — and is left as is. It is recorded here so the next reader does not
re-open it as an unexamined inconsistency.

One residual risk is worth stating plainly: because the client review is a bare status
transition, it has **no second approver and no workflow gate**. The only thing standing
between "client clicks Approve" and "day is finalized" is this action's own permission
check. That is a design choice, and it is the thing to revisit first if attendance disputes
ever become a problem.

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
- **An identity guard built on the wrong storage is not a weak guard — it is a broken
  one.** Asserting "this page is really signed in as Recruiter" by reading
  `localStorage['sb-…-auth-token']` returned `null` on a page that was plainly signed in,
  twice: this app is server-rendered with `@supabase/ssr` and keeps the session in the
  **cookie**. localStorage is genuinely empty. The failure mode is worse than useless —
  it returns `null` whether the page is correct or the harness is wrong, so it cannot tell
  those two apart. Guessing a second shape (`.user.email`, then the JWT claims) produced
  `null` again. What settled it was dumping the actual stores — localStorage keys, cookie
  names, decoded values — rather than reasoning about which one *should* hold it. **Inspect
  the instrument before you trust or fix it.**
- **Prove the guard can fail, or it is decoration.** With a real cookie probe in place the
  identity check was still unproven, because it had only ever been run against a correct
  page. `--identity-canary` asserts the *wrong* identity on purpose; it fails
  (`session email=recruiter@… expected=hr@…`), which is what earns the real run its PASS.
  The same standard is applied to the profile restore via `--skip-profile-restore`:
  **22/23 with `MISMATCH`**, then 23/23 clean.
- **A fixture must not be named identically to the state it is supposed to disturb.** The
  action rewrites the profile to `${first_name} ${last_name}`. Seeding an applicant called
  "Demo Applicant" rewrote "Demo Applicant" with "Demo Applicant", so the profile-restore
  assertion passed whether or not a restore happened — it had no reachable failure state.
  A check that cannot fail is not a check.
- **Seeding above the `try/finally` is a leak, not a style question.** Target resolution
  ran at module top level, so a throw there skipped cleanup entirely. That is precisely how
  an `applicants` row survived into the demo data and was then silently **reused** by every
  later run (the pass finds its target by email), which would have made the leak permanent
  and invisible. Fixture ids are now recorded at module scope on creation and rolled back
  from the `main().catch()`.
- **`error` must be checked before a row is called "missing".** The report of *"no published
  job"* came from discarding *"Could not find the table 'public.job_postings' in the schema
  cache"*. Five published posts existed throughout. An unchecked `error` converts a loud
  schema error into a quiet, confident, and completely wrong data finding.

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
  role sweep: **489 page visits across 13 roles, 0 page errors, 0 console errors**, written
  to `docs/evidence/role-sweep.json` so the number is reproducible rather than remembered.
  Re-verified in full after the download mis-classification below was fixed.
- **Exercised** — driven through the real UI in a browser, with assertions
  against the database, and with the state restored afterwards. This is the
  only evidence that a button *works*.

| Domain | Actions | Exercised end to end |
|---|---|---|
| `lib/leave` | 3 | **3** |
| `lib/admin` | 5 | **5** |
| `lib/recruitment` | 7 | **7** (2 from the hire pass, 5 here) |
| `lib/tickets` | 6 | **6** (2 from the admin pass: create, assign; 4 here: reply, status, both SLA actions) |
| `lib/auth` | 10 | **10** (signup once the email budget allowed it; `resetPasswordAction` driven 8/8 — it needs a session, not an inbox) |
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
| **Total** | **83** | **82** |

### The role sweep was reporting a working download as a page error

Re-running `audit-role-sweep.mjs` after the `cms.manage` grant produced `err=1` on
`superadmin`, `hr` and `operations` — three roles, all of which hold `reports.export`. The
report's own claim above was "471 page visits, 0 console errors, 0 page errors", so either a
regression had appeared or the claim was wrong. It was the claim.

The erroring page was the same one every time: `/app/reports/export`, a route whose entire
job is to return a CSV. `page.goto` **cannot resolve a navigation that is not a document** —
Playwright throws `Download is starting`, the sweep's `catch` stamped the row `THREW`, and the
summary counted it as a page error. The endpoint was working perfectly.

```
superadmin    pages= 39 ok=36 redir=2 empty=0 err=1 noise=0     <- "error"
hr            pages= 54 ok=51 redir=2 empty=0 err=1 noise=0     <- same page
operations    pages= 36 ok=33 redir=2 empty=0 err=1 noise=0     <- same page
```

Now classified as `download`, a clean outcome, and reported separately:

```
superadmin    pages= 39 ok=36 redir=2 empty=0 dl=1 err=0 noise=0
hr            pages= 54 ok=51 redir=2 empty=0 dl=1 err=0 noise=0
operations    pages= 36 ok=33 redir=2 empty=0 dl=1 err=0 noise=0
```

The full 13-role sweep was then re-run end to end with the corrected script, and the claim is
re-established rather than merely repaired:

| | visits |
|---|---|
| Role pages | 479 (13 roles) |
| Marketing pages | 10 |
| **Total** | **489** |
| `ok` / redirected / empty / download | 445 / 27 / 2 / 5 |
| **Page errors** | **0** |
| **Console errors** | **0** |

Two things are worth keeping from this. **A check that cannot tell a successful download from
a broken page is worse than no check**, because it manufactures findings that send you hunting
for a defect that was never there — and this one had been quietly reporting `err=1` on every
role holding `reports.export` for as long as it existed. And **the sweep's evidence was not
committed**: it wrote only `.qa-sweep-report.json` at the repo root, untracked, so "0 page
errors" had nothing behind it but a terminal line. It now also writes
`docs/evidence/role-sweep.json`, which is what makes the table above reproducible.

The previous figure in this report was **471** visits. The corrected sweep measures **489**.
The difference is crawl variance plus the extra page the `cms.manage` grant gives `owner` and
`super_admin` — not a regression, and not worth treating as precise; the load-bearing claim is
`errors = 0`, not the visit count.

### The role sweep had no exit code, and lost a whole role without saying so

Adding the 404 catch-all forced a re-sweep, and the re-sweep came back at **443 visits**
where the committed evidence said 479. That is 36 pages missing — and the script printed
`err=0`, wrote the evidence file, and **exited 0**. The gap was not a regression in the app.
It was the sweep quietly dropping `operations`:

```json
"operations": { "email": "operations@demo.beepabpo.com",
                "login": { "ok": false, "reason": "still on /login" }, "pages": 0 }
```

Three separate defects, found only because the visit count was compared against the
committed run instead of being read as "0 errors":

**1. A failed sign-in was a silent `continue`.** The role's whole page set — 36 visits —
was skipped, recorded in JSON, printed nowhere, and the run still reported success. *Less
coverage reads exactly like more coverage*, which is what makes this the dangerous shape of
audit bug. Now a failed sign-in is counted and fails the run.

**2. The script had no exit-code logic at all.** Not weak logic — none. `process.exit` was
never called, so every number it printed was decoration and nothing could ever gate on it.
"0 page errors" was a claim printed to a terminal, not a result. It now asserts three things:
every role signed in, no page is in a broken state, and a full run covered at least 380
visits.

**3. The cause of the flake was a fixed `waitForTimeout(2500)` before asking "did it log
in?".** Under load — 13 roles signing in back to back, each waiting on a live Supabase
round trip — 2.5 s was sometimes not enough. Replaced with a `waitForFunction` on the
condition being asserted. **A fixed sleep is a guess about a duration; the wait that matters
is for the thing itself.**

The account was never broken, and that was verified rather than assumed:
`qa-probe-account-signin.mjs` confirms a confirmed, non-banned user, an **active**
`organization_memberships` row, and a working password sign-in. (`resolveWorkspace` filters
`status = 'active'`, so an inactive row signs a valid password straight back out to
`/login` — worth knowing before blaming the account.)

**And the canary that proved the new exit logic worked immediately broke the evidence
file.** `audit-role-sweep.mjs definitely-not-a-role` exited 1 correctly — while replacing
the 479-visit report with a 0-visit one. The artefact whose entire job is to be the
reproducible record behind this section's numbers was destroyed by a debugging command,
and it still looked plausible, because an empty report has the same shape as a real one.
Only a full run may now write `docs/evidence/role-sweep.json`; partial runs leave it
alone. Re-verified: the canary now exits 1 *and* leaves the file's mtime unchanged.

The general lesson is the same one recorded for `refresh-demo-timeline.mjs` in §6, and it
is worth stating twice because this is the second time this project has produced it: **a
tool that reports partial success needs its failures asserted, not merely printed.** Here
"443 visits, 0 errors" read like an acceptable outcome. It was a hole in the coverage.

Re-run after the fixes, with every guard active:

```
total role-page visits: 479 across 13 roles
page errors: 0
VERDICT: PASS — every role signed in, no page in a broken state, coverage floor met
```

`operations` is back at its full 36 pages, which is what confirms defect 3 was the cause
rather than a coincidence. The evidence file is restored to a full run and the status mix
re-measured: `ok` 445 / redirected 27 / empty 2 / download 5, zero console noise — one page
shifting between `ok` and `redirected` against the run above is ordinary crawl variance,
and the load-bearing number is still `errors = 0`.

**82 of 83 actions are exercised end to end.** The one remaining is `inviteClientUser`.

**`resetPasswordAction` was called blocked for the wrong reason, and is now driven.** It was
listed as needing "a recovery token from an inbox, and there is no mail provider here". That
is true of the email *arrival* and false of the *action*. Reading it settles it:

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) return { ok: false, error: "This reset link is invalid or has expired." };
await supabase.auth.updateUser({ password: parsed.data.password });
```

It never reads the token. A session is the only input, and a session does not need a mailbox.
`qa-exercise-reset-password.mjs` creates a throwaway account, signs in, and drives the real
form — **8/8** — closing with the round trip that gives the claim its meaning: sign out, sign
in with the **new** password, and confirm the **old** one is rejected with an error on screen.
A "Password updated" message alone would only prove the action returned `ok`.

The emailed-link arrival and the PKCE exchange at `/auth/callback` remain uncovered, because
that genuinely needs a mailbox. The script prints that as a standing `NOT COVERED` line rather
than letting 8/8 imply more than it did.

**One action left, and the budget reasoning still applies.** `inviteClientUser` calls
`admin.inviteUserByEmail`, which is still answering HTTP 429. That is a **budget, not a
wall** — which this session proved the hard way: `signupAction` sat in the "blocked forever"
bucket for most of the QA run, was assumed dead, and then ran to completion the moment the
budget allowed a call through. `check-auth-email-rate-limit.mjs` re-probes all four API calls
and deletes anything it creates, so the assumption is never made twice.

That script also shows the limit is not uniform: `auth.signUp` on the apex domain is
accepted while the same call on the demo subdomain is rate limited, and
`resetPasswordForEmail` is accepted outright. So the remaining block is specific to
`inviteUserByEmail` right now, not a general "mail is off".

**And that block is global, not address-scoped.** Since the rate limit demonstrably varies by
domain for `signUp`, "invites are blocked" needed proving rather than assuming, and one probe
address cannot prove it. `qa-probe-invite-domains.mjs` tries three domains — the demo
subdomain, the apex, and `gmail.com`:

```
BLOCKED  qa-invite-…@demo.beepabpo.com    email rate limit exceeded
BLOCKED  qa-invite-…@beepabpo.com         email rate limit exceeded
BLOCKED  qa-invite-…@gmail.com            email rate limit exceeded
VERDICT: inviteUserByEmail is blocked for every domain tried.
```

A known-good consumer domain being refused rules out address validation and per-domain
config. It is a project-level email budget with nothing left in it. `inviteClientUser` is the
one action of 83 that cannot be driven here, it is blocked by the environment rather than by
this codebase, and the probe deletes anything it manages to create so it is safe to re-run
whenever a window may have reset.

Earlier sessions did leave evidence in `audit_logs` for a few more
(`payroll.period.create`, `applicant.stage_change`, `client.invite`) via ad-hoc
scripts that were not committed as reusable exercises, so the true figure is
somewhere above 12. It is not 81.

`docs/REMAINING_WORK.md` and the table below track what is left.

---

### The list pager offered "Next" on an exactly-full last page. Fixed.

`components/app/list-pager.tsx:39` read `const showNext = rowCount >= pageSize`, and every
caller passed `rowCount={rows.length}` where the query was bounded to at most `pageSize`
rows. So an exactly-full **last** page looked identical to a full page with more behind
it, and "Next" led to an empty page.

The fix fetches `PAGE_SIZE + 1` and drops the sentinel before rendering. The part worth
noting is the consequence: **once the extra row is gone, `rowCount >= pageSize` is exactly
the right test**, so `components/app/list-pager.tsx` needed no change at all. The bug was
never in the predicate — it was in the data feeding it. Applied across **36 pager
instances in 32 pages**, including all six independent lists on `/app/cms`.

The residual risk is named rather than hidden: the invariant now lives in 32 call sites
instead of one place, and nothing at runtime distinguishes a caller who remembered the
slice from one who did not. The mitigation is that
`tests/list-pagination.test.ts` **discovers** pages by walking `app/**/*.tsx` for
`ListPager` rather than keeping a hand-maintained list, and asserts each one slices. A
hand-kept list is exactly how this defect returns.

### P2 — `/app/client/approvals` silently capped a client's queue at 40. Fixed.

A sweep of every `.limit(` in `app/app/**` found exactly one silent cap left on a
decision-making surface. `/app/client/approvals` read:

```ts
.eq("approval_status", "client_review")
.order("work_date", { ascending: false })
.limit(40),
```

No pager, no count, no indication. A client with 41+ days waiting saw exactly 40 and had no
way of knowing more existed — on the one screen whose entire purpose is telling someone what
is waiting for them. Its sibling `/app/client/timesheets` was fixed for precisely this in an
earlier session and **this page was missed**. Every other `.limit()` in the app is a
documented sub-query (search candidates, comment pages, chart samples) or a detail page, so
this was the last one.

Fixed to the same shape as the sibling: `pageParam`, `.range((page - 1) * PAGE_SIZE, page *
PAGE_SIZE)` with the sentinel dropped, an exact `count` query, and `<ListPager>`.

**Proven by driving it, in both directions.**
`qa-probe-client-approvals-pager.mjs` seeds 25 `client_review` days across both employees
under an active client assignment — *inside* the assignment window, because the guard added
in `15a5193` would refuse an out-of-window day and a fixture the product rejects is not a
fixture — signs in as the client, and reads two pages.

| Build | Result |
|---|---|
| **Before the fix** | **0/5** — page 1 rendered all 25 rows; `?page=2` was ignored and rendered the same 25 |
| **After the fix** | **5/5** — page 1 renders 20, page 2 renders 5, all 25 reachable |

The 0/5 matters as much as the 5/5. A probe that has only ever passed cannot distinguish a
working fix from a broken page.

Three harness errors were caught by dumping the page instead of guessing, each of which
would have been easy to report as "pagination is broken":

- `ListPager` renders **only** Previous/Next links, never numbered page links. A locator
  looking for a link reading "2" reported the pager missing on a build that had it.
- The Date column renders as `Oct 2, 2026` — the third date format this repo has used, after
  ISO on the attendance page and `Wed 26` on its week view.
- Counting *distinct dates* is wrong when the fixture spans two employees: the same
  `work_date` legitimately appears twice. Count rows.

And one residue bug worth naming, because it produced a failure three runs later that had
nothing to do with the code: **truncating a probe's output with `Select-Object -First N`
closes the pipe and kills node before its `finally` block runs.** Twenty-five seeded rows
survived, and the next run failed with "only 8 free in-window dates" — a fixture-pool
exhaustion that looked like a product problem. `qa-cleanup-approval-fixtures.mjs` removes
them, scoped to `approval_status = 'client_review'` (the seeded demo data is entirely
`finalized`, so it cannot touch a real row), and the baseline was verified back to 40 rows.
Redirect to a file and read the file; do not truncate a probe that writes.

### P1 — Two more `.limit()`s where the code meant "all of them". Fixed.

The `/app/client/approvals` fix above came from sweeping one pattern class. The same sweep
run across `lib/**` found two more of the same bug, and they are worse than the original
because of where they sit.

**Payroll seeding — the money path.** `createPayrollPeriod` seeded draft payroll records
from:

```ts
.from("employees").select("id")
.eq("organization_id", BEEPA_ORG_ID)
.eq("employment_status", "active")
.limit(500)
```

Three separate failures in five lines:

1. An org with more than 500 active employees got records for **some** of them, while the
   action returned `ok: true` with `seeded: 500`. Anyone dropped had **no payroll record at
   all** and nothing in the response said so.
2. There is **no `.order()`**. PostgREST makes no promise about ordering without one, so the
   set is not "the first 500" — it is an arbitrary 500, and it can differ between two runs
   over identical data.
3. `salaryByEmployee.get(e.id) ?? 0` then pays **0** for anyone whose salary row was missed,
   which is the quiet-money version of the same bug.

A BPO passing 500 headcount is routine, not an edge case.

**Ticket assignees.** `listTicketAssignees` offered `.limit(100)` internal members as
assignees. Past 100 internal staff, the 101st teammate simply could not be put on a ticket —
no error, no indication, just a person who is unassignable.

**Both fixed** through a new `lib/pagination/fetch-all.ts`. `fetchAllByRange()` walks
`.range()` in pages and throws past `maxPages` rather than returning a partial list. The
`order` is load-bearing and documented as such: `.range()` over an order that is not *total*
can skip or repeat rows, which would trade a silent omission for a silent duplicate. Payroll
orders by `id`; assignees order by `created_at` **then `id`**, because `created_at` alone is
not unique.

The helper is a separate module rather than inline in `actions.ts`, because that file is
`"use server"` where every export must be an async server action.

**Proven on the code, because the demo data cannot reach either cap** — the org has 10
active employees (2% of 500) and 13 internal members (13% of 100).
`tests/silent-cap-paging.test.ts` drives `fetchAllByRange` against a stub serving **1200**
rows at 500 per page — three pages, all returned — and pins the properties that matter:

- every row is returned well past one page;
- an exactly-full final page does not trigger a further request, and a short page ends the walk;
- **past `maxPages` it throws** rather than returning a list that looks complete — this is
  what separates "no cap" from "a bigger cap";
- a page error names the page number and the operation;
- neither call site contains a bare `.limit(` on an active-employee query, and the assignees
  order is tie-broken by `id`.

Measured headroom is reported by `qa-probe-silent-caps.mjs` rather than asserted from memory,
so the day this stops being latent, the probe says so.

Three of those assertions failed on their first run, all because they matched the **comment
prose explaining the fix** — a comment saying "the previous `.limit(100)`" reads as exactly
the pattern being proved absent. The tests now strip comments before asserting on source. An
assertion about what code does must not be falsifiable by what a comment says about it.

## 5b. Regression sweep after a batch of product changes

Seven product changes landed in one stretch — the pager sweep across 32 pages, storage RLS,
auth copy, the client-timesheet guard, the approvals pager, and two silent-cap fixes. None of
them was verified against the others, which is how a fix quietly breaks the thing next to
it. So every committed exercise was re-run against the build containing all of them.

| Exercise | Result |
|---|---|
| `list-filters` | **35/35** — 27 pages, 3 roles. The pager change is the one most likely to break this |
| `client-timesheet` | **14/14** after the audit fix (was 13/14 — found the gap above) |
| `payroll-workflow` | 19/19 — after the `.limit(500)` paging rewrite |
| `attendance-workflow` | 31/31 |
| `cms-workflow` | 43/43 |
| `money-workflow` | 33/33 |
| `tickets-workflow` | 33/33 — after the assignee paging rewrite |
| `documents-workflow` | 31/31 |
| `notifications-workflow` | 16/16 |
| `nte-workflow` | 24/24 |
| `profile-workflow` | 19/19 |
| `crm-workflow` | 21/21 |
| `recruitment-workflow` | 23/23 |
| `leave-workflow` | 13/13 |
| `ticket-workflow` | 10/10 |
| `auth-workflow` | 35/35; 2 paths BLOCKED by the 429 (signup creation, and the forgot-password anti-enumeration comparison) |
| `admin-workflow` | all assertions PASS; invite path BLOCKED by the 429 |
| `internal-links` | **29/29** — was 28/29; the payroll dead link was a stale `approval_requests` row, not audit history |
| `hire-workflow` | **23/23** — was a harness crash, resolved below |

Two results here are worth more than the green ticks: the sweep **found a real defect**
(the audit gap, which had been a standing 13/14) and it **verified the one assertion that had
been honestly reported as unverified** — the signup applicant-role check now passes 6/6 with
*"that membership carries the applicant role — 1 role row(s)"*.

`hire-workflow` died on `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` from
`src\win\async.c`. It is now **resolved**, and the crash was never the interesting part.

**The crash was not `process.exit()`.** It was this: the exercise body was top-level
`await`, so *any* throw rejected the module and Node tore the process down while undici and
Playwright handles were still closing. It reproduced on a throw from a script that never
launched a browser at all. The assertion was a symptom of an unhandled rejection racing
handle teardown; the native abort then replaced the real error message and returned exit
code 3221226505. Wrapping the body in `main()` with a `.catch()` keeps the failure on the
normal exit path, so the message survives and the process drains its handles instead of
racing them. **A missing table and a missing seed row had both been reading as a Node bug.**

**And behind the crash was a harness bug that had been masquerading as a data problem.**
The run reported `Error: no published job`. There were five published job posts the entire
time. The script queried `job_postings` — the table is `job_posts` — and destructured
`{ data: job }` without checking `error`, so PostgREST's *"Could not find the table
'public.job_postings' in the schema cache"* was discarded and an empty result was reported
as missing data. The FK was misspelled too: `job_posting_id`, not `job_post_id`. The app
was consistent throughout (`lib/recruitment/actions.ts` uses `job_post_id`); both errors
were in the harness.

Four defects, all in the harness, none in the product:

| Defect | Consequence |
|---|---|
| `job_postings` + `job_posting_id`, and `error` discarded | "no published job" — a false diagnosis of a table that never existed |
| Fixture seeded at `offer`, then asked to move to `offer` | `handleChange` ignores an unchanged stage, so no dialog; the run died on a 30s click timeout. The app was right; the fixture contradicted itself |
| Seeding ran *above* the `try/finally` | a throw during target resolution skipped cleanup entirely and leaked the `applicants` row into the demo data |
| `must()` returns `data ?? []`, so a `maybeSingle` miss is a **truthy** `[]` | `finalApp === null` was false for a genuinely deleted row, and a run that had restored the database perfectly scored as a failure |

The seeding gap is now closed at the source: fixture ids are recorded at module scope the
moment they are created, and the `.catch()` on `main()` rolls them back if resolution fails
at any point. The leaked row was found by `qa-probe-hire-fixture-state.mjs` and removed by
`qa-cleanup-hire-fixture.mjs`, which is scoped to a marker no demo row carries.

One more, and the most dangerous shape of the four: a stale identifier inside `restore()`
threw, which skipped the rest of cleanup **including the verification that was supposed to
prove cleanup worked** — and the run still printed `17/17 checks passed` and exited 0,
because the throw was swallowed by a `console.error` in the `finally`. **A check that never
ran reported as a pass.** A cleanup failure is now recorded through `check()`, so it lands
in the tally and forces a non-zero exit.

### Storage RLS raised instead of denying on a malformed path. Fixed.

Six policies in `20260906000800_storage_buckets.sql` cast the first folder segment of a
storage object name straight to `uuid`. Object names are caller-supplied, so any
non-uuid first segment made Postgres raise inside the policy check. A policy that
raises is not a policy that denies — and since the error aborts the statement, a single
malformed object made **every** read against that bucket fail. That is a denial of
service, not just a wrong answer.

`20261011130000_storage_rls_safe_uuid_cast.sql` adds an immutable
`public.try_uuid(text)` (regex-guarded `CASE`, pure SQL rather than a PL/pgSQL
`EXCEPTION` block, which is a subtransaction and cannot be treated as a safe constant in
policy expressions) and drops/recreates all six policies with semantics preserved
verbatim.

**The part that would have made this worse.** The two helpers behave differently on NULL,
and the naive fix routes straight into a privilege escalation:

- `is_self_employee(NULL)` is a bare `exists(...)`, so it returns **false**. The safe cast
  alone denies, and those policies need no second guard.
- `can_access_client(NULL)` **can return true**. Its permission terms never reference the
  argument, so anyone holding `clients.read`, `clients.manage` or `system.manage` gets
  true for *any* org id including NULL.

Routing `can_access_client` through a NULL-returning cast alone would have converted
"raise, therefore deny" into **"grant the whole bucket"**, for precisely the accounts most
likely to hold those permissions. Those three policies take an explicit `is not null`
guard, which is true on well-formed paths, so no working access was narrowed.

Verified behaviourally rather than by reading the stored expression: the live bucket
really does contain a malformed object (`client-documents/demo/…`), and listing it as four
authenticated demo users now returns `ok, []` instead of a Postgres error, while an
employee still sees only their own folder and hr sees all seven.

## 6. Still open

| # | Item | Why |
|---|---|---|
| 1 | Approver queue defaults to `?status=pending`, hiding step-2 work | Product decision, not a defect to redesign silently |
| 2 | **Admin role-assign and cron paths** | **Now exercised** — 18/18, see §4. Two defects found and fixed |
| 3 | **Hire pipeline** | **Now exercised** — 23/23, see §4. The harness was hiding four of its own bugs behind a "no published job" error; the product button worked throughout |
| 4 | **1 of 83 server actions not yet driven end to end** | See §5. `resetPasswordAction` is **now driven, 8/8** — it was called blocked on the grounds that it needed a recovery token from an inbox, but the action never reads the token; it needs a *session*, and a session does not need a mailbox. What genuinely stays uncovered is the emailed link's arrival and the PKCE exchange at `/auth/callback`, and the script prints that as a standing line. The one remaining action is `inviteClientUser`, waiting on the environment's email budget. Neither is blocked by a defect in this codebase. `check-auth-email-rate-limit.mjs` prints exactly what is still blocking |
| 5 | **Invite account creation** | Blocked by Supabase email rate limiting in this environment, specifically `admin.inviteUserByEmail`. **Signup account creation is no longer on this list** — it ran end to end, creating a real account and applicant membership, once the budget allowed one call through. That is the whole reason to keep re-probing instead of writing a blocker down once. The limit is also not uniform: `auth.signUp` on the apex domain is accepted while the same call on the demo subdomain is limited, and `resetPasswordForEmail` is accepted outright. Check with `node scripts/audit/check-auth-email-rate-limit.mjs`, which deletes anything it creates |
| 6 | `super_admin` holds 21 of 50 permissions | **Now measured, not just counted** — `qa-inspect-super-admin-gaps.mjs`. See below. A deliberate platform-vs-business split is defensible; the gap that was not defensible is `cms.manage`, held by **only `marketing`** — not by `owner`, not by `super_admin`. **Now fixed** — `20261012010000_cms_manage_admin_recovery.sql` grants it to `owner` and `super_admin` as well; `marketing` keeps it, and `super_admin` moves to **22 of 50**. **New, measured after that fix:** `permissions.manage` is now the **only** permission in the system held by exactly one role (`super_admin`) — the same single-seat shape `cms.manage` had. It is left as a product decision: it is a platform power and `super_admin` is the platform role, so giving `owner` it blurs the split deliberately drawn above. But if the `super_admin` seat is ever emptied, nobody can grant a permission to anybody. Flagged, not changed |
| 7 | **Storage RLS casts with `::uuid`, which RAISES rather than denies** | **Fixed** — `20261011130000_storage_rls_safe_uuid_cast.sql`, applied and verified behaviourally. Six policies guarded by an immutable `public.try_uuid(text)`. The important part is what the naive fix would have caused: `can_access_client(NULL)` can return TRUE for anyone holding `clients.read`/`clients.manage`/`system.manage`, because those permission terms never reference the argument — so routing it through a NULL-returning cast alone would have converted "raise, therefore deny" into "grant the whole bucket". Those three policies take an explicit `is not null` guard. Verified against a real malformed object (`client-documents/demo/…`): the listing now returns `ok, []` instead of a Postgres error |
| 8 | **Client timesheet P1: submit accepts a day the client view filters out** | **Fixed and driven through the UI** — `submitTimesheetForClientReview` refuses a day outside the employee's client assignment window before writing `client_review`. `qa-probe-timesheet-window-guard.mjs` seeds one in-window day and one out-of-window day, clicks the real "Send to client" button, and asserts 4/4 — including that the refused record's `approval_status` is **unchanged**, which is the ordering claim a source assertion cannot prove. **This finding was nearly withdrawn on bad evidence — the near-miss is recorded below** |
| 9 | **List pager offers "Next" on the last page when it is exactly full** | **Fixed** — 36 pager instances across 32 pages now fetch `PAGE_SIZE + 1` and drop the sentinel row before rendering. `components/app/list-pager.tsx` needed **no change**: once the extra row is gone, `rowCount >= pageSize` is exactly the right test. The residual risk is that the invariant now lives in 32 call sites rather than one place, so the test discovers pages by walking `app/**/*.tsx` for `ListPager` rather than keeping a hand-written list |
| 10 | Push delivery on a real device | Needs hardware; re-subscribe required after the VAPID rotation |
| 11 | Playwright e2e not running in CI | Needs `RUN_E2E=true` plus secrets |
| 12 | Nothing is pushed to `origin` | `origin/main` is 10 commits and ~371 files behind this branch |
| 13 | Demo tenant decays; gate needs `refresh-demo-timeline.mjs --apply` first | See below — this is an operational landmine, not a code defect |
| 14 | **Applicants have no ticket surface** | A ticket notification can only point an applicant at `/app/applicant`, because `/app/my/requests` is behind the employee shell and redirects them to `/app`. Whether an applicant should be able to track their own tickets is a product call — §4 |
| 15 | **Payroll exercise leaves a stale audit link each run** | It creates a period, writes 3 audit rows, then deletes the period, so the audit page links to a record that no longer exists. All 3 `payroll_period` audit references are stale. Deleting audit rows needs sign-off, so it is left visible and reported by `qa-exercise-internal-links.mjs` |
| 14 | `payslip_items` / `payslip_components` | **Resolved, not open.** They do not exist — an earlier audit of mine guessed them. The app uses `payroll_components` |
| 15 | `resetPasswordAction` | Needs a real recovery token from an inbox; no mail provider in this environment. Part of the 2-action gap in row 4. The invalid-token path on `verifyEmailAction` *is* proven |
| 16 | **Withdrawn — "4 CMS-built `/careers` slugs are link-reachable but absent from the sitemap"** | **Not a real gap.** All five `/careers` slugs are in the sitemap. The reading that said otherwise came from a stale build artifact; see "The sitemap findings below were a measurement error" in §2. Kept in the list so nobody re-derives it from the git history |
| 17 | **`/app` not-found pages are served with HTTP 200, not 404** | **Pre-existing, documented, deliberately not fixed.** `app/app/loading.tsx` puts a Suspense boundary above every app page, so the response starts streaming, the status is committed as 200, and the later `notFound()` cannot change it. Proven by controlled comparison: `(marketing)` has no `loading.tsx` and `/resources/<bad-slug>` calls the same `notFound()` and correctly returns 404. **Left alone on purpose** — removing `loading.tsx` would trade a correct status code for the slow-TLS hang those files prevent; `/app` is `noindex, nofollow` so no crawler is affected; the page the user sees is correct. Only monitoring would read a soft-404 as a success. `qa-probe-not-found.mjs` records it in an `observations` array rather than dropping the assertion |
| 18 | ~~**Confirm dialogs lose keyboard focus on Escape**~~ | **WITHDRAWN — the defect was real, the diagnosis and the "still open" status were not.** This row was written after a fix that restored focus on Cancel but still not on Escape, blaming Base UI's `closeOnFocusOut` branch (`FloatingFocusManager.js:591`). That branch is inside `else if (portalContext?.portalNode)` and a modal dialog never reaches it. Instrumenting `finalFocus` showed it was called on **both** paths and returned `null` on Escape because the probe had focused the control *before React registered the capture listener* — a broken instrument, not a library limit. With a fresh context and a settle before the first interaction, **both paths pass: 16/16**. See §2 for the full correction. Kept so nobody re-derives the wrong root cause from the git history |

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
node scripts/audit/qa-exercise-hire-workflow.mjs    # 23 assertions
node scripts/audit/qa-exercise-reset-password.mjs  # 8 assertions; NOT COVERED line is printed
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
node scripts/audit/qa-exercise-client-timesheet-workflow.mjs # 14/14 (was 13/14; the finding is fixed)
node scripts/audit/qa-exercise-tickets-workflow.mjs          # 33 assertions
node scripts/audit/qa-exercise-list-filters.mjs             # 35 assertions, 27 pages, 3 roles
node scripts/audit/qa-exercise-internal-links.mjs         # 29 assertions, 4 passes, incl. sitemap
node scripts/audit/qa-repair-notification-routes.mjs       # idempotent; repairs role-blind ticket links
node scripts/audit/check-auth-email-rate-limit.mjs          # exits 0 the moment the 429 clears
node scripts/audit/qa-exercise-signup-workflow.mjs          # signupAction e2e; exit 2 = BLOCKED, not failed
node scripts/audit/qa-probe-client-timesheet-window.mjs     # does the view hide out-of-window days?
node scripts/audit/qa-check-realtime-residue.mjs            # did the realtime probe leak a notification row?
node scripts/audit/qa-repair-mojibake.mjs <file> [--check]   # deterministic mojibake repair; --check reports only
node scripts/audit/qa-show-nonascii.mjs <file> [--strip-bom] # code points, not console rendering
node scripts/audit/qa-exercise-sitemap-unpublish.mjs        # rebuilds the app; needs `rm -rf .next` first (see §2)
node scripts/audit/qa-cleanup-sitemap-probe.mjs            # removes ONLY rows these sitemap probes created
node scripts/audit/qa-probe-client-timesheet.mjs          # read-only: can this flow run here at all?
node scripts/audit/qa-probe-summary-view-filter.mjs     # read-only: which predicate hides a record from the client view
node scripts/audit/qa-probe-not-found.mjs                    # 18 assertions; proves every 404 has a way out that works
node scripts/audit/qa-probe-dialog-keyboard.mjs                # 16 assertions, read-only; Escape + Cancel both restore focus
node scripts/audit/qa-probe-command-palette.mjs             # 11 assertions; opens, filters, navigates, and returns focus
node scripts/audit/qa-probe-notification-bell.mjs          # 10 assertions; accessible name, AA contrast, keyboard exit
# Responsive. MUST be chunked: one process over all 28 routes x 8 viewports reaches
# 2.4 GB and takes the app server with it. Four chunks of ~7 routes, ~140s each.
node scripts/audit-app-responsive.mjs owner@demo.beepabpo.com /app/dashboard /app/my /app/my/attendance /app/my/leave /app/my/payroll /app/my/requests /app/my/documents
# ...run the remaining 21 default routes in three more chunks of seven.
# `/app/cms` needs the marketing account: node scripts/audit-app-responsive.mjs marketing@demo.beepabpo.com /app/cms
node scripts/audit-responsive.mjs                           # public surface; same QA_BASE_URL convention
node scripts/audit/qa-probe-account-signin.mjs [email]        # read-only: can this demo account actually sign in, and is its membership active
node scripts/audit/audit-role-sweep.mjs [role ...]           # 13 roles; exits non-zero on a failed sign-in, a broken page, or too little coverage

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