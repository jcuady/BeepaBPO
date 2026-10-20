# Feature Verification Checklist — BeepoBPO

**Result: 21 exercises, 490 assertions (482 distinct behaviours), 20 PASS, 1 BLOCKED, 0 FAIL, 0 SKIPPED.**
Payroll, attendance and notifications all work; every one of the 13 demo roles is now
driven by at least one real workflow; and two genuine product defects were found and
fixed — the sitemap was being served frozen from the build, so newly published articles
could never reach search engines, and `reset()` silently did nothing on most fields in
five forms (§5a).

**On "every button works":** rather than assert it, it is measured. Across 13 roles and 444
page visits the app exposes **199 pressable controls** (buttons, excluding nav chrome);
**197 of them (99.0%)** have a label that appears in some assertion's name. Form fields
(118) are counted and published separately — a field is covered by being filled, and this
matcher reads assertion *names*, so it cannot measure that; see §"The field figure is not a
gap count" below.

That number is a **proxy, not a measurement**, and it is wrong in both directions — see the
long note below. The important part is not the percentage: it is that every unmatched
*button* is chased to ground. Three were flagged on the current build and all three were
resolved by reading the code and the run evidence, not by adjusting the figure. One of them
was a genuine hole — the cash-advance **Reject** button had **never once been pressed**, and
the reject leg of a money workflow had zero executions. It is now covered, end to end
through the real UI.

**What this document is.** A per-feature answer to "does this work", each row backed by an
executable check that was actually run against a production build with real database state.
Rows are not marked working on the strength of a page loading.

**How to reproduce everything here.**

```powershell
pnpm build
npx next start -p 3100                       # leave running

node scripts/audit/qa-run-workflows.mjs       # all 21 exercises
node scripts/audit/qa-run-workflows.mjs --list
node scripts/audit/qa-run-workflows.mjs --only=payroll,attendance
node scripts/audit/qa-run-workflows.mjs --batch=5    # chunked, if the server is dying
node scripts/audit/qa-workflow-assertion-index.mjs   # distinct behaviours
node scripts/audit/qa-control-surface-census.mjs      # button surface vs. assertions
node scripts/audit/qa-run-all.mjs --all       # presentation + role sweep + gates
```

Evidence lands in `docs/evidence/workflow-<id>.json` (every assertion, not only the failures),
`docs/evidence/workflow-summary.json` (a **rollup over all 21 registered exercises** — each
row carries the `when` of the run that produced it, so a verdict is never presented as
fresher than the measurement behind it), `docs/evidence/workflow-assertion-index.json`, and
`docs/evidence/control-surface-census.json`.

**Verdict vocabulary.** `PASS` / `FAIL` / `BLOCKED` (environment refused — email budget, not a
product result) / `SKIPPED` (server stopped answering mid-run; the exercise never ran).

---

## 1. The three features asked about directly

| Feature | Verdict | Evidence | What was actually done |
|---|---|---|---|
| HR payroll | **WORKS** | 19/19 assertions | Signed in as `owner` (holds `payroll.manage`), edited a salary, created a semi-monthly period, seeded 10 records, ran Recalculate, submitted for approval, drove the **two-step** approval chain to `finalized`, confirmed all 10 records finalized. Cleanup asserted: periods 2→2, records 11→11, payslips 1→1, audit 241→241, salary restored. |
| Attendance | **WORKS** | 31/31 assertions | Clock in / clock out creating and closing today's record, `worked_minutes` matching the real gap, correction request → HR approval, record visible in the heatmap, HR delete. Cleanup asserted: records 201→201, corrections 0→0, approvals 26→26. |
| Notifications | **WORKS** | 16/16 assertions | Driven as `teamlead@` (17 notifications): mark-one sets `read_at`, mark-all clears, **another user's notification is neither displayed nor touched** by mark-all, email-digest preference persists and round-trips. Cleanup asserted: all 17 `read_at` values restored, 0 markers left behind. |

## 2. Every exercise, with its real count

21 registered exercises, **472 assertions, 464 of them distinct named behaviours**,
in a single run against a production build on real database state.

| Exercise | Verdict | Assertions | What it drives |
|---|---|---|---|
| auth | PASS | 35 | sign in/out, sign-out-everywhere, access-denied, no account leakage |
| **signup** | **BLOCKED** | 4 | applicant registration reaches verification — **success path unproven**; the 4 assertions cover the *refusal* path, which is proven |
| payroll | PASS | 19 | salary edit, period, recalculate, 2-step approval to finalized |
| attendance | PASS | 31 | clock in/out, corrections, HR approval, delete |
| leave | PASS | 13 | request, approve/deny, balance impact |
| notifications | PASS | 16 | mark one/all read, per-user isolation, digest preference |
| tickets | PASS | 33 | ticket list, create, status transitions |
| documents | PASS | 31 | upload, list, visibility scoping |
| nte | PASS | 24 | notification to evaluate, accept/decline |
| client-timesheet | PASS | 14 | client approves submitted timesheets |
| money | PASS | 33 | cash advances and billing across the lifecycle |
| recruitment | PASS | 23 | job, applicant, pipeline stage moves |
| crm | PASS | 21 | lead and deal lifecycle with activity log |
| cms | PASS | 43 | publish and unpublish round trip |
| hire | PASS | 23 | hire to employee, org membership, cleanup |
| **admin-workflow** | **BLOCKED** | 18 | admin actions behind their permission (18 non-email checks ran and passed) |
| profile | PASS | 19 | profile read and write persistence |
| list-filters | PASS | 33 | filtering, search and pagination on list views |
| ticket-detail | PASS | 10 | single ticket detail, assignment and status change |
| sitemap | PASS | 12 | unpublish leaves the sitemap and republish restores it |
| uncovered-roles | PASS | 17 | sales, finance, client_viewer — the three roles no other exercise drives |

`20 PASS, 1 BLOCKED, 0 FAIL, 0 SKIPPED.` The remaining BLOCKED row is the
**admin-invite success leg** (§4) — Supabase's SMTP quota, a different resource
from the sign-up limiter that cleared — not a product failure. `admin-workflow`
still contributes its 18 passing assertions, and the invite's *refusal* path is
proven and asserted. Signup was BLOCKED here until the limiter cleared after
~14h; it now passes for real.

### Why a pass count is not the answer to "every button works"

480 assertions could be one button pressed 480 ways, or 480 different controls.
`qa-workflow-assertion-index.mjs` deduplicates them from the evidence files, so the
number that matters is **distinct named behaviours**, each listed per exercise in
`docs/evidence/workflow-assertion-index.json`.

Cross-exercise overlap is reported too: only **2** behaviours are asserted by more than
one exercise — `"no page errors"` and `"no unexpected console errors"`, each across five
exercises. Those are per-session hygiene checks and legitimately repeat. No product
behaviour is double-counted to pad the total.

### Measuring the button surface instead of hedging about it

"Every button works" deserves a denominator. `qa-control-surface-census.mjs` walks every
route the role sweep proved reachable, inventories every visible interactive control on
each, and cross-references the labels against the assertion names:

- **Pressable controls** (buttons, excluding nav chrome) are the primary figure. This is the
  population "every button works" actually asks about.
- **Form fields** are counted and published **separately and never added in**. A field is
  covered by being *filled*; the matcher reads assertion **names**, and assertions are named
  for outcomes, so a field's coverage cannot be read off this instrument at all.
- **Navigation links** are reported separately and deliberately *not* added in — they are
  covered by a stronger gate, `qa-exercise-internal-links.mjs`, which asserts every link
  resolves.
- The label match is **word-level against assertion names only**, with URLs and JSON
  stripped out of the haystack.

**Measured on the current build (13 roles / 444 page visits, 1 page failed, 0 sign-outs):**

| | found | label matched | |
|---|---|---|---|
| **Pressable controls** (buttons, nav excluded) — PRIMARY | **199** | **197** | **99.0%** |
| of which **unmatched** | — | — | **2**, both artefacts (`Save`, `Continue`) — both are pressed and work; see below |
| Form fields (typed into, never pressed) — reported separately | 118 | 97 | 82.2% — **not** a button-coverage figure |
| Navigation links (covered by `qa-exercise-internal-links.mjs` instead) | 45 | 30 | 66.7% |

516 distinct controls in total, and **0 with no accessible name**.

**The field figure is not a gap count, and must never be quoted as one.** Two independent
mechanisms make it under-report, both verified against the exercises:

1. **Assertions are named for outcomes, not controls.** The CMS exercise fills `slug`,
   `excerpt`, `summary`, `description` and `#about-headline` (see its `create:` fixtures and
   the `#about-headline` step); the assertions are called *"the edit is persisted"* and
   *"upsertAboutPage writes the About content"*. Neither contains a field label.
2. **A label is not a field id.** *"Cover note"* is `<Label htmlFor="notes">` — the exercise
   fills `#notes` — so a matcher looking for the word "Cover note" cannot see the fill even
   when it happened.

A sample was traced to the source for both mechanisms. **All 21 have since been traced
individually, and none is an unfilled field**: 17 are demonstrably filled by an exercise,
1 (`Method`) is exercised at its default only, 2 (`Week of`, `To`) are driven by URL
params, 1 (`Description` on `/app/my/requests`) could not be placed, and 0 are unfilled.
`Visibility` is not a form field at all — it is derived from the uploader's permission, and
the documents exercise asserts the derived value. See `REMAINING_WORK.md` §2.14a, including
the two automated sweeps that got this wrong first. Treat the field number as a published
denominator, not as a defect list.

**The metric is wrong in BOTH directions, so it is a proxy and not a measurement.** A
"match" means some assertion's *name* mentions that label as a word.

- It **over**-reports: a label appearing in an assertion name does not prove the control
  was pressed, nor pressed in every state it can occupy. The opposite error was made here
  three times before being caught — see §5b.
- It **under**-reports, and this is the direction that hides real gaps. Measured on the
  current build it flagged three buttons:
  - **`Reject` on `/app/cash-advances` was a genuine hole.** `CashAdvanceReviewButtons`
    renders Approve *and* Reject, both calling `reviewCashAdvance`, and only Approve had
    ever been pressed — the reject leg of a money workflow had **zero** executions, while
    an assertion listed `"rejected"` among acceptable end states. Now covered: 6 new
    assertions, 33 → 39, and the census no longer flags it.
  - **`Save` on `/app/payroll/settings` and `Continue` on `/app/payroll/periods` are
    artefacts**, and remain flagged. Both are pressed and both work — proved from the run,
    not from the code: `salary change persisted — 120000 -> 120111` is the Save click, and
    `a new payroll period was created` is the Continue click. The assertions are named for
    the *outcome*, not the control.

So an unmatched control is a **question**, never a finding. Each of these three was chased
to ground before anything was written down.

**The 50 unmatched controls are otherwise form fields**, which are the expected artefact of
this metric: `reason`, `description`, `notes`, `slug`, `currentPassword`, `linkedin_url`,
`visibility`, and the status/option values in `<select>`s (`won`, `lost`, `screening`).

The attendance correction, the profile write and the job application are all exercised,
under behaviour names rather than field names.

**The two buttons this list originally contained are now closed.** `Cancel` and `Reset` on
`/app/my/leave` were asserted by nothing; the leave exercise now clicks Reset on a deliberately
dirty form and drives Cancel through its confirmation dialog. Doing so is what uncovered the
form-reset defect in §5a — the gap in the checklist found a real bug in the product.

## 3. Roles

Thirteen demo roles exist. Ten are driven through a real workflow by the exercises above.

| Role | Previously exercised | Functional coverage |
|---|---|---|
| owner | payroll, crm, tickets, money, cms, profile | yes |
| super_admin | admin workflows | yes |
| hr | attendance, leave, money, nte, documents, hire | yes |
| recruiter | hire, recruitment | yes |
| marketing | cms, sitemap, admin | yes |
| operations | ticket detail | yes |
| team_lead | leave, notifications | yes |
| employee | attendance, leave, money, nte, documents | yes |
| client_admin | attendance, documents, timesheets, tickets | yes |
| applicant | hire, recruitment, list filters | yes |
| **sales** | **none** | **added — 17 assertions** |
| **finance** | **none** | **added — 17 assertions** |
| **client_viewer** | **none** | **added — 17 assertions** |

`audit-role-sweep.mjs` visits all thirteen, but it is read-only: it navigates and reports console
errors, HTTP status and empty states. It never presses a button. Before this work, three roles had
page-level coverage and **zero** functional coverage.

### What the three new roles proved

| Claim | Measured |
|---|---|
| finance cannot read client billing | `/app/client/billing` → 0 amounts |
| sales cannot read payroll | `/app/payroll` → 0 amounts |
| sales can actually work its pipeline | `/app/crm/leads` populated, not an empty state |
| client_viewer refused the internal payroll app | denied state, 0 amounts |
| client_viewer refused internal reports | denied state, 0 amounts |
| client_viewer renders no billing amounts | 0 amounts (shell loads, data does not) |
| client_viewer has no control client_admin lacks | differential across 4 client pages |

**No data leak was found for any of the three.** RLS held on every surface tested.

## 4. Known limits of this checklist

Stated plainly, because a checklist that only lists passes is a marketing document.

- **Signup is BLOCKED, not proven.** Supabase answers every `auth.signUp` from this network with
  *"Too many sign-up attempts from this network"*. Despite that copy, this is **not** a one-minute
  window: it was still refusing 5 minutes later. The form fill and the action's validation path are
  covered by `tests/signup-intent.test.ts` (real zod execution); account creation end-to-end is not.

  What *is* proven is the refusal path — 4 assertions, all passing: the user is told something
  went wrong, the action does not claim success, and it creates **no** auth user and **no**
  membership row. A server action that renders an error and still leaves a half-made account behind
  is a real defect, and this is the run that gets to check it.

- **Do not run `check-auth-email-rate-limit.mjs` before retrying signup.** It calls `auth.signUp`
  for real and deletes the user afterwards, so it **consumes the very budget the exercise needs**.
  It reported `signUp (apex domain)` as *accepted* and then the exercise was refused immediately
  afterwards and stayed refused. Its old header claimed it was "safe to re-run as often as you
  like", and it was the documented recovery step — it was burning the window being waited for. The
  script now says this on every run, derives its conclusions from its own measurement instead of
  hardcoding "signUp is rate limited", and warns when it consumed budget. **Wait, then run
  `qa-exercise-signup-workflow.mjs` on its own.**
- **Admin invite is BLOCKED** for the same reason — one invite per email window.
  `qa-exercise-reset-password.mjs` is still registered nowhere, for that reason, and is
  listed in the runner's "not registered" report so the omission reads as deliberate
  rather than forgotten. Only its **new-address** legs need mail; the reset-action legs
  do not and run clean at 8/8. `qa-exercise-client-invite.mjs` **is** registered now —
  its existing-account leg needs no mail at all.
- **`/auth/callback` needed no mailbox and was still untested.** It is now registered
  (`auth-callback`, fast tier) and passes 8/8. Building it found a **real defect**: the
  route has always redirected failures to `/login?error=auth_callback`, and nothing
  anywhere read that parameter — `auth_callback` appeared exactly once in the codebase,
  on the line that produced it. So every expired or already-used signup and reset link
  dropped the person on a plain login form that said nothing at all. Fixed, and the fix
  is mutation-proven: removing the read turns exactly one check red.
- **The exercises share one database.** They must run serially; two at once corrupt each
  other's cleanup and the failure looks like a product bug. A notification raised by the leave
  exercise can land while the notifications exercise is running, so those assertions are scoped
  to the ids snapshotted at the click, and late arrivals are counted and reported.
- **`next start` dies under sustained browser load** in this environment (the same ~2.4 GB limit
  `qa-run-all.mjs` documents for its responsive sweep). A dead server yields `SKIPPED`, never
  `FAIL`, and the run stops rather than manufacturing verdicts. Use `--batch=5`, or restart
  between `--only` groups, to get full coverage.
- **`audit-role-sweep.mjs` is read-only.** It navigates, watches for console errors and empty
  states. It never presses a button, so it cannot establish that a feature *works* — only that
  a page renders for that role.
- **A green row means the check ran, not that the feature is bug-free.** Coverage is the ceiling
  on the claim, and §5b is the proof: most of what was found here was wrong checking, not wrong
  product.

## 5. Defects found and fixed while producing this

Two very different kinds of thing went wrong, and conflating them would overstate
the result. Only the first group is a defect in the product.

### 5a. A real defect in the product

| Defect | Impact | Fix |
|---|---|---|
| **`app/sitemap.ts` had no dynamic export, so `/sitemap.xml` was prerendered at build time.** Next served it `x-nextjs-cache: HIT` indefinitely. | Any article published after a build was invisible to search engines until the next deploy. Content marketing could publish and get no indexing, with nothing on screen indicating a problem. | `export const dynamic = "force-dynamic"` — verified as `ƒ /sitemap.xml` in the build output and 200 with no cache header at runtime. |

`revalidate = 3600` (ISR) was tried first and **did not fix it**: ISR still served the
pre-publication sitemap for up to an hour, so a freshly published article was still missing.
Correctness-on-read was chosen over saving three indexed queries. The `sitemap` exercise was
rewritten to assert the real guarantee — a newly published article appears in the sitemap
without a rebuild — because it had been asserting the old build-frozen contract.

| Defect | Impact | Fix |
|---|---|---|
| **Five forms' `reset()` silently failed on some of their fields.** `react-hook-form` only writes into an *uncontrolled* input when it has a value to write, and every field in these forms is registered uncontrolled — so any field absent from the `defaults` object kept whatever the user had typed. | `leave-request-form` had `defaults = { reason: "" }`, so **Reset cleared the reason and left both dates and the leave type in place** (measured: `start=2026-11-05` after clicking Reset). The same reset runs *after a successful submit*, so a second leave request could inherit the first one's dates. `create-lead-form` is the worst shape: `company_name`, `contact_email`, `contact_name`, `contact_phone` and `industry` survived, so **creating a second lead silently inherits the first company's details**. Also affected `create-ticket-form`, `cash-advance-form` and `correction-request-form`. | every registered field now has an explicit default. `pnpm audit:form-reset-defaults` fails the build if a form regresses to partial defaults. |

**Why this survived until now:** nothing asserted what Reset *does*, only that it exists.
The defect was found by measuring the button — clicking Reset on a deliberately dirty form —
and the reason is general: a button's existence is not its behaviour.

| Defect | Impact | Fix |
|---|---|---|
| **The homepage scrolled sideways by 149px on a 375px phone** (`scrollWidth=524`). `1fr` is `minmax(auto, 1fr)`, so a grid track's floor is its content's min-content width — and the service list holds unbreakable names ("eLearning Course Development") inside a `Button` that ships `shrink-0`, so neither the track nor the button would compress. | On the most common phone width, the page a visitor lands on first scrolled sideways by 40%, with the hero and the service list cut off at the right edge. | `minmax(0, 1fr)` on the affected tracks, `min-width: 0` on their children, `flex-wrap` on the service button and its label div, and a single column below 480px. Desktop geometry is unchanged — those tracks already exceed min-content there. `scrollWidth` is now **375 = clientWidth**. |
| **The platform-preview mock's table was clipped on a phone** | Every cell carries `whitespace-nowrap`, and the mobile type floor raises the table to 16px, so its four columns need ~396px inside a ~331px container. `.dashboard` clips, so the page never scrolled — the **Performance column was simply cut off**, and `audit:responsive` reported it as `BLEED 13` at 375px and 393px | cells wrap below 480px with tighter padding, so the table takes the width it has. `audit:responsive` is **120/120, exit 0** — measured on a proven-current build, *after* the fix, which is what distinguishes it from the earlier 120/120 that was hiding a 149px overflow |
| **The "Open" link in a notification card was underlined only on hover** (`text-green-strong hover:underline`, inside a `<p>` of body text). | `text-green-strong` against `text-slate` measures **1.01:1**. WCAG 1.4.1 requires a link in a text block to be distinguishable without colour alone, and the only other affordance appeared on hover. **A touch device has no hover**, so on a phone the link read as plain text with nothing marking it tappable. Found by axe as a serious `link-in-text-block` violation. | `underline` rather than `hover:underline` — the link is now distinguishable on every input device, not only the ones with a pointer. |

### 5b. Defects in the QA harness (the checks were lying, not the product)

| Defect | How it lied | Fix |
|---|---|---|
| Signup exercise filled `#company`, which stopped rendering when the form became role-aware | failed on a 20s fill timeout and reported nothing about signup at all — silent loss of coverage | exercise selects the audience first; both applicant and client paths now run |
| `next start` died under sustained browser load and every later exercise failed against a dead socket | attendance produced **five confident, specific, entirely fictional failures** and leaked a record that broke the next run's precondition | runner probes the server before believing a failure, reports `SKIPPED`, and stops; the leaked record was identified by id and removed (202→201) |
| Admin workflow matched `/rate limit/i` but the UI says *"Unable to send the invite right now"* | the `BLOCKED` branch was **unreachable code**, and blocked-only runs exited `0` while printing "These are UNKNOWN, not passing" | matches the real copy; `BLOCKED` exits `2` |
| Notifications asserted zero unread across all rows | flaked whenever the leave exercise's async rows landed mid-run | scoped to the ids snapshotted at click time; late arrivals counted and reported |
| `qa-exercise-uncovered-roles.mjs` v1 conflated URL-reachability with data-exposure | 6 false failures on nav labels, notification titles, and `tickets.self` "Create ticket" | rewritten around two real properties (no money exposure; a **differential** viewer-vs-admin button comparison with badge-count normalisation) |
| `workflow-summary.json` recorded only the exercises run in that invocation | a `--only=sitemap` run overwrote a 21-exercise tally with a single `PASS` — the file answering a far smaller question than its name implies | summary is now a rollup over all 21 registered exercises, each carrying its own `when`; a missing evidence file reports `NO_EVIDENCE` rather than vanishing from the count |
| `--only=payrol,attendance` ran attendance alone and exited green | a request for two areas quietly became a request for one | unknown ids are an error (exit 2), checked before the empty-selection case |
| `pnpm lint` reported **7 errors** from `BeepaBPO new landing design/` | `.gitignore:81` excludes that sandbox from the repo, but ESLint's flat config does not read `.gitignore` — so the gate was permanently red for a directory that is not this project's code, and stayed red after any correct fix to app code | added the path to `globalIgnores`; `pnpm lint` is green again. The 7 violations are real *in that sandbox* and are left visible to whoever owns it |
| Twenty workflow exercises were registered nowhere and wrote no evidence | they ran only when someone remembered the command; "is payroll functional?" was answerable only by knowing a filename | `qa-run-workflows.mjs`: registry, per-exercise evidence files, orphan detection, `--batch` for surviving the server limit |
| `check-auth-email-rate-limit.mjs` calls `auth.signUp` for real, then deletes the user | **it consumed the very budget the signup exercise needed**, and its header claimed it was "safe to re-run as often as you like". It was the documented recovery step for a blocked exercise — it was burning the window being waited for | header now says so on every run; conclusions derived from its own measurement instead of hardcoded "signUp is rate limited"; warns when it consumed budget |
| `qa-workflow-assertion-index.mjs` stored behaviour names **only under `--verbose`** | `workflow-assertion-index.json` shipped counts with no list, so the census matched against an empty haystack and reported a confident, fictional **0% coverage** with a 117-item "actionable list" attached | names always stored; the census now aborts rather than cross-referencing an empty list |
| The index also matched **its own output file** (`workflow-assertion-index.json` matches `workflow-*.json`) | every run indexed the previous run as a 22nd "exercise", and the exercise count crept upward on each invocation | self excluded by name |
| `qa-control-surface-census.mjs` returned from `signIn` immediately after clicking submit | sign-in is a live Supabase round trip, so every page was fetched while unauthenticated and bounced to `/login`. It inventoried **the sign-in page 13 times** and reported "0% coverage, 0 pages failed", because every navigation had technically succeeded — the exact trap `audit-role-sweep.mjs` documents | waits for the condition, not a duration; records the **actual landed URL**, not the requested path; a bounce to `/login` counts as a failure; the run aborts if it never left the login page |
| The census matched labels against full assertion strings including their **detail** | `"Dashboard"` matched an assertion whose detail was the URL `.../app/dashboard`, and `"Recruitment"` matched a JSON blob — producing a flattering **84.3% coverage** built mostly on incidental text | haystack is the assertion name only, URLs and JSON stripped; navigation links reported separately and excluded from the primary figure. It had also been flattering the product for a *second* reason — it flagged no buttons at all, on a role list two days stale (see the census staleness row below). Both directions of that error were eventually corrected |
| The census extractor read only `textContent` for a control's name | the sidebar's brand link wraps `<Image alt="BEEPA">`, and an `alt` contributes nothing to `textContent` — so the link was reported as **an icon-only control with no accessible name at all**. A defect in the measurement was about to be written up as an a11y defect in the product | extractor reads descendant `img[alt]`; the finding disappeared on its own, which is the correct outcome |
| A rate-limited signup run reported BLOCKED with **0 assertions** | "nothing was learned" — but when the environment refuses to send, the product still owes the user an error, owes them *not* a success claim, and must not leave a half-made account behind. The run gave up before checking any of it | 4 assertions now run on the refusal path, all passing: error shown, no success claimed, **no auth user created, no membership created** |
| **`audit:migrations` printed "pending: 4" from a hardcoded filename list** and never queried anything | it had been right once and then went stale silently. `supabase migration list` shows all 38 migrations in **both** the Local and Remote columns, and `db push --dry-run` answers "Remote database is up to date". `docs/REMAINING_WORK.md` had said "zero pending" the whole time — the documentation was right and the gate was wrong | the script no longer prints a pending count it cannot know, points at the command that can, and preflights all 38 structurally. `tests/migration-preflight.test.ts` asserted `toContain("pending: 4")` — a test *guarding the lie* — and now pins "never prints a pending count" |
| **`audit:wiring` reported two "buttons with no handler"** | both were prose inside JSDoc blocks: *"clicking a `<button>` does NOT focus it"* and *"renders a Base UI `<button>`…"*. The scanner read raw source, so a sentence describing a control counted as the control | structural scans now read comment-stripped source, line numbers preserved. **Mutation-tested**, not assumed: a planted dead button is still caught at the right line, a planted `<button>` in a comment is not. 2 findings → 0 |
| **`audit:rbac` flagged `/app/[...rest]`** as unauthorized | the route's entire body is `notFound()`; it can read nothing, and authentication happens in the layout above it. Its per-section table also printed `0/1 <-- REVIEW` for sections whose only member was a correctly-exempt route — which reads as four problems when the audit had one | added to the exempt set with the reasoning inline; a section is flagged only when it holds a page that is neither gated nor exempt. 75/79, exit 0 |
| **`audit:action-rbac` flagged `careerInquiryAction`** as an unguarded server action | it is the public career enquiry dialog, with the same protections as the `contactAction` beside it. The audit tolerates an `// unauthenticated:` marker — but only scans 300 characters above the export, and the word was buried in a long docstring | one short marker line, as its sibling has. 64/65, exit 0 |
| `docs/QA_REPORT.md` concluded the sitemap defect "does not exist" | it contradicted **itself** 30 lines later ("a newly published article will not reach the sitemap until the next deploy") and contradicted `app/sitemap.ts` | a SUPERSEDED note now sits where the wrong claim is first read, pointing at `FEATURE_CHECKLIST.md` §5a. The measurement-error lessons below it are still correct and worth keeping |
| **`verify-all.mjs --skip-migration` skipped nothing** — there was no migration step for it to skip | its only effect was to convert a failed realtime probe into a *skipped* step citing `migration 20261006140000 not pushed yet`. `supabase migration list` shows that migration **applied on the remote**. So the flag bought a green release for a broken notification path, with a cause that was not true. A second gate, `audit:migrations`, was declared in `package.json` and invoked by nothing | the flag now skips a real migration preflight, added as a step; the fabricated excuse is deleted and a failed probe fails with its own diagnosis. `tests/release-gate-honesty.test.ts` + `tests/audit-gate-integrity.test.ts` pin both |
| **`audit:suite-base-url` reported "41 browser-driving scripts agree"** while blind to three classes of file | it only examined scripts **importing Playwright** — so `smoke-cron.mjs`, which uses plain `fetch`, was never looked at, despite the file's own rule saying "any script that drives a browser **or fetches a page**". It also matched only the literal shape `const BASE =`, missing a lowercase `const base =`. And it excused any script with no env override as "cannot drift" — which is simply false | rewrote the detector: any script performing HTTP, any variable name, any URL literal, with a **string-aware** comment stripper (the regex version used by four sibling gates deletes `"http://…"` from the `//` onward — it would have eaten the literal under test). Population **41 → 58**; found **4 more genuinely drifted scripts**: `smoke-cron`, `audit-targets`, `audit-text-list`, `shot-space` — the last of which had been screenshotting a connection-refused page into `e2e-evidence/` as if it were the landing page. **Mutation-proven**: all three blindness shapes planted at once, all caught |
| `smoke-cron.mjs` read `CRON_SECRET` from the environment only, requiring `--env-file=.env.local` | a gate runner spawns a bare `node <script>`. Wiring it in unchanged would have produced `CRON_SECRET missing` on **every** run — a permanently red gate, which is how gates get switched off and then believed when they are wrong | it reads `.env.local` itself, as its siblings already do |
| **`audit:gate-coverage` v1 scanned only `qa-run-all.mjs`** | it reported **"28 of 35 declared scripts are never run by any gate"**. False: `verify-all.mjs` invokes most of them. A coverage check with a false gap is worse than none — the reader either ignores the file or trusts the number | scans both orchestrators; setup/repair/planning scripts reported as their own group rather than as gaps; a runner counts as gated by being the gate. First honest run: **11 ungated → 8 real → 0**, after registering all 8 with a runner. A missing runner now exits 2 rather than silently comparing against zero paths |
| **The workflow suite measured a server 65 minutes older than the build on disk** | this is the largest single loss of evidence in the campaign. A full 21-exercise run produced **482 assertions against code that had been replaced**: the server started at 18:16, `pnpm build` wrote `.next/BUILD_ID` at 19:21. One assertion failed with *"Unable to create account with that email"* — copy `signupErrorMessage` cannot produce, and `qa-probe-signup-error.mjs` confirmed Supabase really does return the 429 the fixed code branches on. It read as a live auth defect and sent the investigation at the wrong file. Re-run on a current build: **35/35 PASS**. The runner probed that the server was *alive*, which is not the question | `/api/health` reports `process.uptime()` against the age of `.next/BUILD_ID`; `audit:server-fresh` gates on it, and `qa-run-workflows.mjs` now **refuses to produce evidence** unless the server is current. A 404 on the route means the running build predates it — reported as "cannot tell", never as fine |
| the staleness rule was **written inverted** (`uptime < buildAge`) | every correctly restarted server reported itself stale one second after `next start`, because by then the build is older than the process. Reading the live `/api/health` response caught it; reasoning about it had not | extracted to `lib/server/build-freshness.ts` so a table test can pin the direction, and `tests/server-build-freshness.test.ts` asserts both directions plus the boundary and the cannot-tell case. The first draft of the "fresh" fixture asserted `false` for a genuinely stale pair — the fixture was wrong, not the function |
| `audit:server-fresh` called `process.exit()` after a top-level `await fetch` | it printed `VERDICT: the server is running the build on disk` and then aborted with `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` (Windows libuv, 0xC0000409). A gate that reports correctly and exits on a crash code is one whose result cannot be trusted, because the runner only ever sees the number | sets `process.exitCode` and returns on every path. Verified: an unreachable server exits **2**, never 0 |
| The touch-target check measured base-ui's **hidden form inputs** | `/app/my/notifications` yields six `[role="switch"]` elements — the three real switches, plus one `0x0` hidden input each, which base-ui renders alongside every control. The guard only skipped `display:none` and `visibility:hidden`, both of which a laid-out zero-sized element passes. The overlay arithmetic then turned `0x0` into a fictitious **"24x30"**, so the check failed three controls that are in fact **56×48** — comfortably above the minimum. It had been failing since the preference switches were added | the check now skips elements with no area, and uses `checkVisibility` so `opacity:0` and `content-visibility` are covered too. It still measures every real control, and a genuinely small one still fails |
| The account menu's sign-out locator was ambiguous | `getByRole("menuitem", { name: /sign out/i })` matches **both** "Sign out" and "Sign out everywhere", so Playwright's strict mode failed the visibility check. It read as a product defect — an account menu whose sign-out never appears — when the menu was fine and the locator was not | `exact: true` |
| **`audit:responsive` reported `/` clean at 375px while it overflowed by 149px** | its committed evidence was written at 11:11 UTC, before the current build (12:41 UTC). Nothing established its relationship to the build on disk, which is the same failure `audit-server-fresh` now catches for a server process. It had been reporting agreement it had not earned for longer than the homepage defect existed | the overflow was fixed and the evidence regenerated on a proven-current build. `audit:server-fresh` is the general answer for the process case; the evidence case still depends on running the audit after the build |
| `qa-exercise-admin-workflow.mjs` waited a **fixed 4000ms** for the cron dry-run summary | it FAILED a full-suite run with *"no summary line found"* and passed minutes later on an idle server — a flake wearing a product defect's clothes. The dry-run walks three real jobs, and a 4s budget that passes when the box is quiet and fails when busy measures the box | waits on the condition (60s ceiling) and, on timeout, reports what the page actually said. The test-push assertion, which read the database after a fixed 3500ms, now polls to a bound instead |
| **The cash-advance `Reject` button had never been pressed** | `CashAdvanceReviewButtons` renders Approve **and** Reject, both calling `reviewCashAdvance(requestId, action)`, but the money exercise only ever drove the approve leg — so the reject leg of a money workflow had **zero** executions. Meanwhile an assertion listed `"rejected"` among acceptable end states, which is how an unexercised path reads as covered. Found by the census, then confirmed in the product source rather than assumed | a second request is created and rejected through the real UI: the row is scoped by marker, the destructive confirm dialog's copy is asserted, the status must land on `rejected`, and the engine must have written a `reject` action row — not an approval. 33 → **39 assertions, all passing** |
| **The control census measured the previous build's pages** | it does not discover which pages to walk — it reads `role-sweep.json`. The census written at 06:45 UTC today read a `role-sweep.json` last written **2026-10-13**, so its headline "84.5% of action controls covered" was computed over two-day-old routes. Nothing reported it: the script's own header names the failure (*"running it first would silently measure the previous run's routes"*) and then relies on registry ordering alone, which does nothing when the script is run directly — which is how every audit here is normally run | aborts (exit 2) when `role-sweep.json` is older than `.next/BUILD_ID`, before launching a browser, and records both input ages in its own evidence. Same rule as `audit-server-fresh`, applied to an evidence input instead of a process. Proven live: it fired on the real stale pair and named both timestamps |
| **`generate-page-inventory.mjs` never listed the homepage** | its matcher was `/^(.*)\/(page|route)\.tsx?$/`, which requires a `/` before `page.tsx`. The homepage is `app/page.tsx`, whose relative path is `page.tsx` with no directory — so it did not match and the one route every visitor lands on was dropped. Two things hid it: `--check` only compares the committed file against what the function produces, so a subject the function cannot see is never reported missing; and the stale file still listed `/` pointing at `app/(marketing)/page.tsx`, which no longer exists, so the wrong row read as ordinary staleness. Found only because the ship gate failed on an unrelated new route and forced the file to be regenerated | directory part made optional. `93 → 96` pages, and `/` now resolves to `app/page.tsx` |
| `tests/realtime-probe-contract.test.ts` required the fabricated excuse to exist | `expect(verifyCode).toMatch(/marker === "DELIVERY_FAILED" && SKIP_MIGRATION/)` pinned the very branch that turned a failed delivery probe into a skip citing an **applied** migration. A test guarding a lie — the same shape as `migration-preflight.test.ts` asserting `"pending: 4"` | rewritten to assert the opposite: the excuse is absent and `--skip-migration` skips a real migration check. The invariant it was protecting (a skip is never counted as passed) is asserted in `release-gate-honesty.test.ts`, against the accounting rather than one branch |
| **Matrix row 21c — responsive *per role* — had no runner at all** | it was carried as "100/100 across 7 roles, recorded 2026-10-09" and labelled *inherited* for six days. Not stale: **un-runnable**. `audit-app-responsive.mjs` signs in as the account you name, but its only route list is the owner's 28, and it scores any page it cannot open as `DENIED forbidden` — so `finance` reported 32 layout failures that were pure RBAC, and client/applicant accounts reached `0/28` | a reachability pre-pass measures only what the role can open, **reporting** the excluded routes rather than discarding them; the summary states its own denominator; a role that can open nothing exits 2 instead of reporting `0/0` as clean; per-segment route pools (`CLIENT_ROUTES`, `APPLICANT_ROUTES`) so `/app/client/*` is audited at all. **178/178** across 7 roles, all exit 0 |
| **The per-role evidence filename exceeded Windows' 260-char `MAX_PATH`** | the sweep printed `56/56 viewport-route combinations clean`, then `writeFileSync` threw ENOENT and the process exited 1 — **it reported success and could not record that it had succeeded**, which this project's own rule says is a finding, not a pass. And because the slug was built from routes alone, two roles over the same routes produced the *identical* name and the second silently overwrote the first — the per-role re-run would have destroyed seven of the eight files it existed to produce | slug capped at 80 chars, prefixed with the account, suffixed with a SHA-256 digest of the swept routes. `tests/app-responsive-evidence-name.test.ts` asserts the **old recipe still overflows 260** — the mutation leg |
| **`audit:server-fresh` proved the server matches the build, not that the build matches the source** | `source → build → process` has three links and it checked two. Edit a product file, skip `pnpm build`, and the verdict stays *fine* — uptime is still under the build's age, so the process genuinely does match the build — while every assertion describes code that was never compiled. The same class as the stale server it was written for, one step further down | `isBuildBehindSource()` closes it; `audit-server-fresh` walks `app/`, `components/`, `lib/` and prints `newest source` beside `build age`. **Proven on the real repo, not a fixture**: the first live run exited 1 because `build-freshness.ts` had itself been edited after the build |
| `qa-probe-dialog-keyboard` sampled focus **before the dialog took it** | it read `document.activeElement` the instant `waitForSelector(…, {state:"visible"})` resolved. Base UI moves focus in an effect that runs *after* mount — measured at **visible +25ms, focused +27ms** — so a 2ms window produced `FAIL … activeElement SELECT#ticket-status-…` against a dialog that takes focus correctly. The same probe had **passed** on 2026-10-13. A defect that appears and disappears with machine speed is an instrument fault | bounded poll (`waitForFocusInside`, 1500ms) that **reports the delay** (`focus inside after 1ms`) instead of rounding it away, with the failure leg pinned by `tests/dialog-focus-wait.test.ts` — deleting the assertion would have silenced a real failure on a dialog guarding 21 irreversible mutations with no X to escape to |
| **The realtime gate step failed twice with opposite causes** | First observation: failed in one `verify-all.mjs` run on 2026-10-16, passed on re-run and standalone (191ms). Recorded then as an unreproduced transient. Second observation, same day, later: `DELIVERY_FAILED` with the **hard** signature — subscribed OK, row inserted, and **no event in 60 000 ms**, not merely a late one. Both times only inside the gate; standalone it delivered in 221, 262, 320, 329, 353 and 523 ms across six runs. The publication was proven good independently: `test-realtime.mjs` subscribes cleanly to **all 19** published tables, `notifications` among them, so this was never the missing-migration story the gate told before | The probe had a **blind spot, and its own first run proved it**. It stopped listening to the subscribe callback after the first `SUBSCRIBED`, so a channel that died mid-attempt was indistinguishable from a delivery outage — and the run it could not see was a `CLOSED` status it was never told about. It now watches the status for the whole attempt and retries on a fresh channel; `DELIVERY_FAILED` requires a channel that stayed `SUBSCRIBED` for its entire life, and a run where no channel was ever healthy reports `CHANNEL_UNSTABLE` (transport), which is the honest name for it. **Proof without a synthetic mutation**: the first run of the new probe had attempt 1 miss, attempt 2 deliver in 329 ms — the old code would have printed `DELIVERY_FAILED` and failed the gate. That run also exposed a bug **in the new instrument**: `removeChannel` fires `CLOSED` by design, so reading the status after teardown printed `CLOSED (healthy throughout)` — two contradictory claims at once. The status is now captured before teardown and returned from that capture, and `tests/realtime-probe-contract.test.ts` (19 → 23 tests) pins both, each with a negative control |
| **`audit:role-pages` wrote no evidence file, and three documents disagreed about it** | The matrix said "**222/222, exit 0, ✅ Verified today**"; the ledger said "**219/219, re-run 2026-10-09**". Both were printed numbers with nothing behind either. The script ended at `process.exit(...)` having written nothing, and `qa-run-all.mjs` registered it with `evidence: null` — so the runner's own rule that *a green check with no evidence file is a finding* was satisfied by declaring the exemption. That is how the two numbers drifted: the route set grew after 2026-10-09, nothing re-measured it, and no file existed for anyone to notice. Re-run: **222/222**, which is the matrix's number — so the **ledger** was the stale one, and it is corrected rather than the matrix | the script writes `docs/evidence/role-pages.json` (base, per-role pass counts, every result, both the page count and the role count, which are different measurements), and the registry now declares it so the runner enforces the file. The broader finding is recorded below |
| **Ten of the thirty registered checks are exempt from the evidence rule** — and six matrix rows quote numbers from them | `qa-run-all.mjs` sets `evidence: null` for `form-reset-defaults`, `suite-base-url`, `seo-metadata`, `performance`, `payslip-exposure`, `attendance-tz`, `cron-smoke`, `server-fresh`, `gate-coverage` and `gate`. Matrix rows 2, 3, 7, 7b, 25 and 26 each quote a specific figure from one of those — "58 HTTP-performing scripts", "0 ungated", "28 forms scanned, 21 that reset", "clean" — all marked **✅ Verified today** with no file behind them. Two of them (`server-fresh`, `gate-coverage`) were added **this session**, so this is the same defect being introduced and criticised in one sitting | `audit:server-fresh` now writes `docs/evidence/server-fresh.json` with its verdict, both ages, the build id and the exit code — including the *unreachable* case, so "we did not measure" can never be mistaken for "nothing was wrong". It fired the moment it was added, reporting BEHIND SOURCE on a build whose content was byte-identical, because a mutation test had reverted a source file after the build: it compares mtimes, not content, and that conservatism is now documented rather than tuned away. The remaining eight are **not** fixed here; the honest summary is that six matrix rows rest on terminal output rather than evidence, and closing that is P2 work listed in `REMAINING_WORK` |
| **Two sub-16px body-copy violations on phones**, in shared components | `/app/my/documents` (`category · date`) and the notification **body** in `notifications-page-client.tsx` — while the timestamp two lines below already carried `text-base sm:text-xs`. Neither is visible to the owner-only sweep (row 21b): the audit skips text under 25 chars, so **the verdict depended on seed data** — teamlead's document name is 28 chars and tripped it, owner's is shorter and passed the identical component. The second was found only on the first client-segment sweep ever run | both to `text-base md:text-sm` / `text-base sm:text-sm`, unchanged on desktop. The threshold itself is the remaining defect and is recorded in `REMAINING_WORK` §2.8 with the 7 latent sites — lowering the number would turn every short label into a failure |
| **The `/careers` filter grid gave the primary action a 43.578px column** | the filter bar was a `md:grid-cols-12` grid across a 698.9px container, so every track was **43.57px** — already under the 44px touch minimum before anything was placed in it. The search field took four tracks, each select two, and the Filter button took the last one: the form's submit button was **half a pixel** under the size the repo's own rule requires, and only at one viewport (iPad Mini, 768x1024) | the grid is now `md:grid-cols-6` — six tracks of 103.15px, search on two, everything else on one. The search field and the three selects keep the exact widths they had; only the button changes, and every track in that grid is now more than twice the minimum, so the trap cannot be re-entered by adding a field. Found by the responsive sweep on the **first full run** after the page was rebuilt |
| **The touch-target audits rounded their measurements** | `Math.round` turned a target 43.578px wide into `w: 44, h: 44` in the evidence file, sitting next to a `FAIL` verdict. A reader would conclude the *check* was broken rather than the button, and the number in the file was not the number the rule compared | two decimals in `audit-responsive.mjs`, `audit-app-responsive.mjs` and `audit-targets.mjs`. **Proved by running the real script against a page with a deliberately 43.578px button**: it now records `w: 43.56` next to the FAIL, where the old code would have written `44` |
| **A new unit test inherited the runner's dependency on a live server** | the test spawned `qa-run-all.mjs`, which probes `$QA_BASE_URL/api/health` before every check, and pointed at the default `localhost:3100`. It passed **only when an app server happened to be running**. The ship gate caught it — its vitest step runs with no server, so the runner skipped the check, exited 2, and the test failed there while passing everywhere else. The gate reported **23/24 — "Do not ship."** | the test brings its own health server and spawns asynchronously. `spawnSync` was the first attempt and it **blocks the event loop**, so the in-process server could not answer the probe and the runner again concluded the server was down — the same failure in a different hat. It now passes with **nothing listening on 3100**, which is the ship gate's condition, and with a server up as well |

**The recurring lesson.** Every item in 5b produced a confident, specific, wrong
statement. None would have been caught by reading the code, and the two most
damaging — five fictional attendance failures and the summary that quietly
answered a smaller question — were only visible once the check was asked to prove
its own failure modes.

## 6. Design consistency

Held by the presentation tier (`qa-run-all.mjs`), unchanged by this work:

- `audit:design` — 0 raw primitives, 0 hardcoded colours, **1 arbitrary radius value / 3 uses**
  (252 files scanned; the 4 raw-primitive files are documented, deliberate exceptions).
  The radius figure was previously reported as **0** because the count excluded `components/ui/` —
  the exclusion is right for the primitive and colour checks and wrong for the radius one, and it
  was hiding the last off-scale value in the repo: `rounded-[2px]` ×3 in `components/ui/chart.tsx`
  (2 legend swatches) and `components/ui/tooltip.tsx` (the arrow). The audit now counts every
  scanned file and names the file each value lives in.
- `audit:contrast` — WCAG 2.2 AA measured on rendered pixels, not asserted
- `audit:typography` — DM Sans on marketing/auth, Inter in the product app
- `audit:runtime-radius` — computed corner radius on painted elements
- `audit:responsive` — 120/120 viewport-route combinations across 15 public + auth routes
- 44px touch targets and the 16px mobile body-copy floor, enforced by measurement

## 7. Gate state at the time of writing

| Gate | Result |
|---|---|
| `pnpm test` | **745 passed / 96 files** |
| `pnpm typecheck` | **0 errors** |
| `pnpm lint` | **0 errors, 15 warnings** (warnings are `@next/next/no-img-element`, pre-existing) |
| `pnpm audit:design` | clean |
| `qa-run-workflows.mjs` | 21 exercises, **490 assertions, 20 PASS / 1 BLOCKED / 0 FAIL**, on a build verified current by `audit:server-fresh` |
| `qa-workflow-assertion-index.mjs` | **480** distinct named behaviours; only 2 asserted by more than one exercise |
| `qa-control-surface-census.mjs` | 444 page visits, 13 roles, **1 page failed**; 199 pressable controls, **99.0%** label overlap; 118 fields reported separately; **0 controls without an accessible name** |
| `audit:form-reset-defaults` | 28 forms scanned, 21 that reset — every one defaults every field it registers |
| `audit:gate-coverage` | **0 of 36** declared audit/verify/smoke scripts ungated; 7 seed/fix/planning reported as not-gates |
| `audit:suite-base-url` | 58 HTTP-performing scripts, 0 disagree on origin |
| `audit:server-fresh` | the process answering is newer than `.next/BUILD_ID` |

**Still outstanding, and needing you rather than a code change:**

- **VAPID push-notification keys are only in local `.env.local`.** Vercel does not have them set,
  so web push will not fire in production until you add them. Every other notification surface
  (in-app, email digest) is verified working.
- **Signup's success path and the admin invite cannot be proven until the Supabase project's
  signup/invite limit clears.** They are reported BLOCKED, not passed — and note the limit is
  much longer-lived than its own "wait a minute" message suggests. **Do not run the rate-limit
  probe first**; it consumes the budget (§4).
- **`Cancel` and `Reset` on `/app/my/leave` were asserted by nothing.** They were the only two
  unmatched buttons on the measured surface. **This is now closed** — the leave exercise clicks
  Reset on a deliberately dirty form and drives Cancel through its confirmation dialog, and doing
  so is what surfaced the form-reset defect in §5a.