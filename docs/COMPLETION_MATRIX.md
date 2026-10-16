# Completion matrix — what is actually proven, and what is not

**Last run: 2026-10-15.** One row per requirement, with the evidence that
establishes it and what is still missing.

This exists because the word "100%" is not a state anyone can point at. It is a
claim about coverage, and a claim about coverage is only meaningful if it has a
denominator and a list of exceptions. So every row below states **what was
measured, on what**, and rows that are not done say so.

Two columns are kept deliberately separate:

- **Verified today** — I ran it in this session and it passed.
- **Inherited** — last recorded on an earlier date and not re-run since. These are
  real results, but they are not current evidence, and are labelled as such
  rather than quietly folded into the same column.

## The matrix

| # | Requirement | Status | Evidence | What remains |
|---|---|---|---|---|
| 1 | **Backend — schema integrity** | ✅ Verified today | 38 migrations on disk, structurally sound; `supabase migration list` shows Local == Remote for **every** row, `db push --dry-run` answers "up to date" | SQL *grammar* was never validated. Structural preflight only |
| 2 | **Backend — payroll correctness** | ✅ Verified today | `audit:payroll-status` 0 incoherent periods, 0 net pay exposed before approval; `audit:payroll` 0 overlapping periods | `evidence/payslip-exposure.json` records **`unapprovedCount: 0`** — see row 3 |
| 3 | **Backend — data exposure** | ⚠️ Verified, with a stated limit | `uncovered-roles` differential proved no money leaks to sales/finance/client_viewer. `audit:payslip-exposure` is **CLEAN but vacuous**: `unapprovedCount: 0`, so the refusal path was never exercised this run | The employee's only `draft` record is correctly withheld from the list, which is a different check. Exercising the 403 needs an unapproved *visible* record — see REMAINING_WORK §2.9 |
| 4 | **RBAC — pages** | ✅ Verified today | `audit:rbac` **75/79** gated, 4 structural exemptions, exit 0 | — |
| 5 | **RBAC — server actions** | ✅ Verified today | `audit:action-rbac` **64/65**, exit 0; the 1 is a public form, annotated `unauthenticated` | — |
| 6 | **Wiring — dead controls** | ✅ Verified today | `audit:wiring` **0 candidates** across 269 `.tsx`, mutation-proven | — |
| 7 | **Forms — reset integrity** | ✅ Verified today | `audit:form-reset-defaults` **28** forms scanned, **21** that reset, **0** with a field that survives a reset | `evidence/form-reset-defaults.json` |
| 7b | **Audit suite — self-consistency** | ✅ Verified today | `audit:suite-base-url` — **60** scripts perform HTTP, **58** of those resolve an origin and are checked, **0** disagree on `QA_BASE_URL`/port 3100. See row 26 — this row's first version read 41 and was wrong | `evidence/suite-base-url.json` |
| 8 | **Every workflow** | ✅ Verified today | 21 exercises, **490 assertions, 20 PASS / 1 BLOCKED / 0 FAIL**, production build, real DB, build proven current | 1 BLOCKED — row 13 (admin-invite *success*; its refusal path is proven) |
| 9 | **Every user / role** | ✅ Verified today | 13 demo roles; 3 previously uncovered (sales, finance, client_viewer) now driven | — |
| 10 | **Buttons** | ✅ Verified today | Census of 13 roles / 444 page visits: 339 action controls, **0 without an accessible name**. Every unmatched *button* is chased to ground: 3 flagged, **1 was a real hole** — the cash-advance `Reject` had never been pressed, so the reject leg of a money workflow had zero executions. Now covered end to end, and the census no longer flags it | The remaining 2 (`Save`, `Continue`) are **artefacts** of label-matching, not gaps — both are pressed and work, proved from the run evidence. Label overlap is wrong in **both** directions |
| 11 | **Filters** | ✅ Verified today | `audit:filters` 33 paginated pages, every filter carried into its pager, exit 0; `list-filters` exercise 33 assertions | — |
| 12 | **Signup — success path** | ✅ **Verified today** | The Supabase sign-up limiter had cleared after ~14h, so `qa-exercise-signup.mjs` ran for real: **PASS, 6 assertions** (was BLOCKED at 4). A real auth user was created, then deleted; `membership rows left: 0` | The row previously read "refuses `auth.signUp` from this network, durably (still refusing after 300s idle)" — **that is no longer true**, and leaving it would have kept a resolved blocker on the board. One leg remains partial: re-submitting an **already-registered** address trips the sign-up limiter, so the duplicate-registration branch is still unmeasured. The script says so itself — `BLOCKED_PARTIAL: first leg valid, duplicate leg unmeasurable` — rather than reporting the partial run as a clean pass |
| 13 | **Admin invite — success path** | ⚠️ **One leg proven, one still blocked** | `qa-exercise-admin-workflow.mjs` is **23/23 PASS**. The previously-untestable leg is now driven: inviting an address that **already has an account** takes the resolve path in `inviteOrResolveAuthUser`, which sends **no mail** and so is not quota-bound. It asserts the UI reports the user was linked, a membership was created, the chosen role arrived **alongside the `employee` baseline**, a `users.invite` audit row was written, and nothing was left behind | **Mutation-proven:** disabling the `already registered` short-circuit turns that check red, and the action then degrades to the mail path and reports *"Too many invites have been sent from this network"* for an account that already existed — a real defect the quota had been hiding. The **new-address** leg is still BLOCKED by Supabase SMTP quota (HTTP 429); that is the environment, and the failure is surfaced to the user, which is asserted |
| 14 | **Password reset** | ⛔ **BLOCKED (narrowly — and the block was overstated twice)** | Three surfaces now measured. `auth` (35 assertions) proves forgot-password answers *identically* for a real and a fake address and never confirms that an account exists, and drives the whole post-reset change-password cycle end to end — wrong current password refused, the new password provably does **not** take effect, the original still works, the correct one succeeds, the new one signs in, the change is undone from the UI, and the original works again. `reset-password` is **8/8**, mutation-proven, including the round trip that gives the claim its meaning. `auth-callback` is **8/8**: no code and bad code both take the failure branch, the bad code really is exchanged and really fails, no session is created, and the failure is now visible to the person | **Unproven: the SUCCESS branch** — exchanging a genuine PKCE `code` for a session — because minting one requires the emailed link. Building the check **found a real defect**: `?error=auth_callback` had no reader anywhere, so every dead signup/reset link landed on a silent login page. Fixed, asserted, mutation-proven. The `admin.generateLink` no-mail shortcut is **not** a substitute: it returns an *implicit*-flow token (`#access_token=…`, no `?code=`), a different entry point from the product's PKCE `resetPasswordForEmail` |
| 15 | **Signup — refusal path** | ✅ Verified today | 4 assertions: error shown, no success claimed, **no auth user and no membership row created** | — |
| 16 | **Design system** | ✅ Verified today | `audit:design` exit 0 — 0 raw primitives, 0 hardcoded colours across 248 files | — |
| 17 | **Unit tests** | ✅ Verified today | **680/680 across 90 files** | — |
| 18 | **Typecheck / lint** | ✅ Verified today | `tsc --noEmit` 0 errors; `eslint` 0 errors | — |
| 19 | **Notification delivery** | ✅ Verified today | 16 assertions incl. per-user isolation — another user's notification is neither shown nor touched by mark-all | **Web push will not fire in production**: VAPID keys are in local `.env.local` only, not Vercel |
| 20 | **Role × page reachability** | ✅ Verified today | `audit:role-pages` **222/222** nav-reachable pages clean across 13 roles, exit 0 | — |
| 21 | **Responsive — public + auth** | ✅ Verified today | `audit:responsive` **120/120** viewport-route combinations clean (15 routes × 8 viewports), exit 0, on a build proven current by `audit:server-fresh` | The figure this row previously carried was **not earned** — the committed file predated the build and was hiding a 149px document overflow on `/`, then a `BLEED 13` on the same route. Both are fixed and the regenerated 120/120 was measured after the fix |
| 21b | **Responsive — product app (routes)** | ✅ Verified today | `audit:app-responsive` **224/224** across 28 routes × 8 viewports (375→1920) as owner, plus **8/8** for `/app/cms` under marketing — **232/232**, all five chunks exit 0, on a build proven current by `audit:server-fresh` | — |
| 21c | **Responsive — per role** | ✅ Verified today | **178/178** viewport-route combinations clean across **7 roles × 390 + 768**, all seven exit 0, on a build proven current by `audit:server-fresh` in **both** directions (server matches build, and build matches source). Per role, over only the routes that role can open: owner **56/56** (28 routes), client admin **26/26** (13), client viewer **26/26** (13), finance **24/24** (12), team lead **24/24** (12), employee **14/14** (7), applicant **8/8** (4) | **This row was not runnable, not merely un-run.** It was "inherited" at 100/100 from 2026-10-09 because no runner existed for it. Running it exposed four defects, all real: two sub-16px body-copy violations the owner-only sweep could not see (`/app/my/documents`, notification bodies), a harness bug that would have overwritten 7 of 8 evidence files, and a second one that scored RBAC denials as layout failures. See `QA_REPORT` rows 21–26 |
| 22 | **Playwright E2E** | ✅ Verified today | `npx playwright test --workers=1` against the current build: **102 passed, 2 skipped, 0 failed** in 3.3 min. Replaces the inherited "100 passed, 4 skipped" (2026-10-09) | The 2 skips are by design. Switching this on in CI still needs the `RUN_E2E=true` repo variable — a settings action, not a code change |
| 23 | **Documentation** | ✅ Verified today | 24 docs + 5 root files; `docs/README.md` is now a single index mapping **one authority per subject**, with each doc's verification date and the two historical contradictions recorded where a reader meets them | — |
| 24 | **Realtime** | ✅ Verified today | `audit:realtime` — authenticated subscriber received a live `notifications` INSERT in **418ms** | — |
| 25 | **Every declared audit is actually gated** | ✅ Verified today | `audit:gate-coverage` — **0 ungated**. **37** declared `audit:`/`verify:`/`smoke:` scripts parsed; **30** wired into one of the two release orchestrators, **7** seed/fix/planning and reported as not-gates by nature | `evidence/gate-coverage.json` |
| 26 | **The audit suite agrees where the app lives** | ✅ Verified today | `audit:suite-base-url` — **60** HTTP-performing scripts, **58** resolve an origin, **0** disagree. Was 41 scanned and **4 real drifts missed**, including one writing connection-refused screenshots into `e2e-evidence/` | `evidence/suite-base-url.json` |
| 27 | **The ship gate does what `--skip-migration` says** | ✅ Verified today | `verify:all` now runs a real migration preflight and the flag skips only that. The fabricated "`20261006140000 not pushed yet`" excuse — which named an **applied** migration to convert a failed realtime probe into a skip — is deleted | — |
| 28 | **The server under test is the build on disk** | ✅ Verified today | `audit:server-fresh` — `uptime` compared against the age of `.next/BUILD_ID`. A full 21-exercise run was found to have measured a server **65 minutes older than the build**; its single FAIL was an artifact, and `auth` re-runs **35/35 PASS** on a current build. `qa-run-workflows.mjs` now refuses to produce evidence otherwise | — |
| 29 | **Page inventory covers every route** | ✅ Verified today | `generate-page-inventory.mjs --check` — **96 pages, 8 handlers**. Its matcher required a `/` before `page.tsx`, so `app/page.tsx` never matched and the **homepage was absent from the inventory entirely**; `--check` could not report it missing, because it only compares the file against what the function produces | — |
| 30 | **No QA check can exempt itself from the evidence rule** | ✅ Verified today | `tests/audit-evidence-coverage.test.ts` — **31** registered checks, **30** declaring an evidence file, **1** named exemption (`gate`, which is vitest + tsc and produces no file). All 30 declared paths exist, parse, and carry a datable timestamp. **Mutation-proven**: setting `cron-smoke` back to `evidence: null` turns it red and names the check | — |
| 31 | **Empty states no demo account can reach** | ✅ Verified today | `qa-probe-unlinked-employee.mjs` **builds** the state rather than hoping to find it: a throwaway internal member with no `employees` row, walked across **5 pages × 2 viewports = 32/32 checks**. Each page renders its empty state, is titled correctly, and keeps body copy at 16px on phone. **Mutation-proven**: reverting one paragraph to `text-sm` turns exactly one check red | The account is created per run and deleted (assertion included), so it is **not** a 14th demo login button and no "13 roles" figure moves. §2.8a had listed five pages; `/app/my/support` has no employee branch at all — the real count is four pages, five paragraphs |

## The honest summary

**Proven and current: rows 1–11, 15–20, 23–27.** Every one of those was executed in this
session against a production build and the real database.

**Blocked by the environment, not by the code: one leg of row 13, and one hop of
row 14.** These are not "probably fine". They are unproven, and reporting them as
anything else is the failure this matrix exists to prevent. Row 12 used to be on
that list and no longer is: the sign-up limiter cleared after ~14 hours, signup now
runs for real and passes 6 assertions. Row 13 was reduced rather than cleared — its
**existing-account** leg turned out not to need SMTP at all, so it is now proven
(23/23); only the **new-address** leg is still blocked, and the error is surfaced to
the user, which is asserted. Row 14 was the most overstated row on this board: it
read "password reset — blocked", when in fact `auth` already proves the
anti-enumeration property and the entire change-password cycle including its undo.
What is missing is one hop — the emailed recovery link — and only that is marked
unproven.

**Row 14 was narrowed again, and the narrowing found a defect.** `/auth/callback` had
**no exercise at all**, on the reasoning that it needed a mailbox. That is false of the
route: its failure branches need nothing but a bad code. Driving them exposed that
`?error=auth_callback` had **no reader anywhere in the codebase** — the string appeared
exactly once, on the redirect that produced it — so a dead link landed on a silent login
page. That is fixed and asserted. What genuinely still needs a mailbox is narrower than
"the emailed link": only the **success** branch, exchanging a real PKCE `code`.

**No row in this matrix is inherited evidence any more.** Row 21c was the last
one, and it went green the hard way: it had no runner at all, so it had been
carried as "100/100, recorded 2026-10-09" since it was written. Building the
runner was the work — the number it produces (**178/178** across 7 roles at
390 + 768) is smaller than the inherited one because each role is now measured
only over the routes that role can actually open, and the omitted routes are
recorded per role under `inaccessible` rather than counted as passes. It also
found two product defects the owner-only sweep (row 21b) structurally could not
see. Note that row 21b going green was **never** evidence for row 21c: they
measure different things over different page sets.

**Known gap: row 19's web push.** The in-app and email-digest paths are proven.
The push path is configured correctly locally and simply has nowhere to send from
in production.

## What this session changed about the claim

Four gates were reporting findings that were not real, and each printed a number
in the same format as a measured one — which is how a wrong gate survives:

- `audit:migrations` printed **"pending: 4"** from a hardcoded filename list, long
  after all four had been applied. `docs/REMAINING_WORK.md` had said "zero pending"
  the whole time. **The documentation was right and the gate was wrong.** A test
  asserted the false number; it now asserts the opposite.
- `audit:wiring` reported **two dead buttons**, both of which were sentences about
  buttons inside JSDoc comments. Mutation-tested after the fix, because the
  obvious failure mode here is blinding the scanner rather than repairing it.
- `audit:rbac` flagged `/app/[...rest]`, a route whose entire body is `notFound()`.
- `audit:action-rbac` flagged a public contact form as an unguarded server action.

And two **audits that could not check anything at all**, which is a quieter and
arguably worse failure than a wrong verdict:

- `audit:attendance-tz` hardcoded a work date and exited 1 once real data landed
  on it. Correct not to overwrite someone's attendance; useless as a check. It
  now finds a genuinely free date and derives its instants from it.
- **Five scripts disagreed with the suite about the port.** `pnpm audit:role-pages`
  reported *"0/13 nav-reachable role pages clean"* and *"13 page(s) a role can SEE
  but cannot USE"* — thirteen connection errors against a server that was running
  the whole time on a different port. Two more were on port 3000, including
  `test-push-roundtrip.mjs`, which would have reported a push-delivery failure
  for a server that simply was not there. `audit:suite-base-url` now lints the
  scripts for this; it found three of the five on its first run, which is the
  case for automating the class instead of fixing the instances.

…and then the gate written to enforce that class turned out to need the same
treatment. It reported **"41 browser-driving scripts agree"** and was wrong three
ways: it only examined Playwright importers (so a plain-`fetch` script was
invisible, despite its own rule covering anything that "fetches a page"), it
matched only the literal source shape `const BASE =`, and it excused scripts with
no env override as "cannot drift" — which is false. Rewritten, the population is
**58** and it found **four more real drifts**, one of which
(`shot-space.mjs`) had been writing connection-refused screenshots into
`e2e-evidence/` as if they were the landing page. It is mutation-tested: all three
blindness shapes planted at once, all caught.

And **the release gate itself** was the last gate to be audited:
`verify-all.mjs --skip-migration` skipped nothing — there was no migration step —
and its only effect was to turn a failed realtime probe into a *skip* citing a
migration that `supabase migration list` shows as **applied**. It now skips a real
migration preflight, and that excuse is gone.

And **eight declared audits were invoked by nothing.** Each could be run by hand,
pass, and change nothing, while carrying a row in this matrix as though it were
covered. `audit:gate-coverage` exists to make that class visible; it is itself
gated. Its first version reported a false "28 of 35" by scanning one orchestrator
instead of both.

And **the evidence itself was measuring the wrong thing.** A full 21-exercise run
produced 482 assertions against a server that had been up 65 minutes *less* than
the age of `.next/BUILD_ID` — it was serving code that had already been replaced.
Its one failure read as a live P2 auth defect (signup blaming the user's address
for a Supabase 429) and pointed the investigation at `lib/auth/actions.ts`, where
the fix had been sitting since 2026-10-10. On a current build the same exercise
is **35/35**. The runner had been probing that the server was *alive*, which is
not the question; it now refuses to produce evidence unless the process answering
is newer than the build on disk.

And two **real product defects** were found and fixed:

1. `reset()` silently did nothing on most fields in **five forms**. react-hook-form
   writes into an uncontrolled input only when it has a value to write, and every
   field lacked one. Measured before the fix: Reset left `start=2026-11-05` in a
   leave form. Worst case, `create-lead-form` kept the company name and contact
   email, so creating a second lead silently inherited the first company's
   details. Now gated by `audit:form-reset-defaults`.
2. `/sitemap.xml` was prerendered and served `x-nextjs-cache: HIT` indefinitely,
   so a published article could not reach search engines until the next deploy.

## How to re-verify all of it

```powershell
pnpm build
npx next start -p 3100                          # leave running

# static, no server needed
pnpm audit:rbac ; pnpm audit:action-rbac ; pnpm audit:wiring
pnpm audit:migrations ; pnpm audit:form-reset-defaults ; pnpm audit:suite-base-url
pnpm audit:gate-coverage ; pnpm audit:design ; pnpm test ; pnpm typecheck ; pnpm lint

# run this FIRST once the server is up — it is what makes the rest trustworthy
pnpm audit:server-fresh

# needs the server
pnpm audit:filters ; pnpm audit:attendance-tz ; pnpm audit:payslip-exposure
node scripts/audit/qa-run-workflows.mjs          # 21 exercises
node scripts/audit/qa-workflow-assertion-index.mjs
node scripts/audit/qa-control-surface-census.mjs
```

The single authority on *what a feature does* is `docs/FEATURE_CHECKLIST.md`. This
matrix is the authority on *what has been checked*.