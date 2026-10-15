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
| 2 | **Backend — payroll correctness** | ✅ Verified today | `audit:payroll-status` 0 incoherent periods, 0 net pay exposed before approval; `audit:payroll` 0 overlapping periods; `audit:payslip-exposure` CLEAN | — |
| 3 | **Backend — data exposure** | ✅ Verified today | `audit:payslip-exposure` clean; `uncovered-roles` differential proved no money leaks to sales/finance/client_viewer | — |
| 4 | **RBAC — pages** | ✅ Verified today | `audit:rbac` **75/79** gated, 4 structural exemptions, exit 0 | — |
| 5 | **RBAC — server actions** | ✅ Verified today | `audit:action-rbac` **64/65**, exit 0; the 1 is a public form, annotated `unauthenticated` | — |
| 6 | **Wiring — dead controls** | ✅ Verified today | `audit:wiring` **0 candidates** across 269 `.tsx`, mutation-proven | — |
| 7 | **Forms — reset integrity** | ✅ Verified today | `audit:form-reset-defaults` 28 forms scanned, 21 that reset, **0** with a field that survives a reset | — |
| 7b | **Audit suite — self-consistency** | ✅ Verified today | `audit:suite-base-url` 41 browser scripts, all agree on `QA_BASE_URL` and port 3100 | — |
| 8 | **Every workflow** | ✅ Verified today | 21 exercises, **480 assertions, 19 PASS / 2 BLOCKED / 0 FAIL**, production build, real DB | 2 BLOCKED — rows 12–13 |
| 9 | **Every user / role** | ✅ Verified today | 13 demo roles; 3 previously uncovered (sales, finance, client_viewer) now driven | — |
| 10 | **Buttons** | ✅ Verified today | Census of 130 pages × 13 roles: **23 of 23 buttons** have a behavioural assertion | — |
| 11 | **Filters** | ✅ Verified today | `audit:filters` 33 paginated pages, every filter carried into its pager, exit 0; `list-filters` exercise 33 assertions | — |
| 12 | **Signup — success path** | ⛔ **BLOCKED** | Supabase refuses `auth.signUp` from this network, durably (still refusing after 300s idle) | Needs the project's signup limit to clear |
| 13 | **Admin invite** | ⛔ **BLOCKED** | Same limiter | Same |
| 14 | **Password reset** | ⛔ **BLOCKED** | Needs a recovery token from an inbox; **no mail provider in this environment** | Different cause — will not clear by waiting |
| 15 | **Signup — refusal path** | ✅ Verified today | 4 assertions: error shown, no success claimed, **no auth user and no membership row created** | — |
| 16 | **Design system** | ✅ Verified today | `audit:design` exit 0 — 0 raw primitives, 0 hardcoded colours across 248 files | — |
| 17 | **Unit tests** | ✅ Verified today | **680/680 across 90 files** | — |
| 18 | **Typecheck / lint** | ✅ Verified today | `tsc --noEmit` 0 errors; `eslint` 0 errors | — |
| 19 | **Notification delivery** | ✅ Verified today | 16 assertions incl. per-user isolation — another user's notification is neither shown nor touched by mark-all | **Web push will not fire in production**: VAPID keys are in local `.env.local` only, not Vercel |
| 20 | **Role × page reachability** | 📋 Inherited | 219/219 clean across 13 roles, recorded 2026-10-09 | Not re-run today |
| 21 | **Responsive** | 📋 Inherited | 224/224 owner routes; 100/100 across roles; 56/56 marketing, recorded 2026-10-09 | Not re-run today |
| 22 | **E2E (Playwright)** | 📋 Inherited | 100 passed, 4 skipped, recorded 2026-10-09 | Needs `RUN_E2E=true` + secrets in CI |
| 23 | **Documentation** | ⚠️ Partial | 24 docs in `docs/` + `AGENTS.md`, `PROJECT_STATUS.md` | Reconciled this session; see below. Still no single index a reader can trust without knowing the history |
| 24 | **Realtime** | 📋 Inherited | PASS — authenticated subscriber received a live INSERT, recorded 2026-10-09 | Not re-run today |

## The honest summary

**Proven and current: rows 1–11, 15–19.** Every one of those was executed in this
session against a production build and the real database.

**Blocked by the environment, not by the code: rows 12–14.** These are not
"probably fine". They are unproven, and reporting them as anything else is the
failure this matrix exists to prevent.

**Inherited, and therefore not current evidence: rows 20–22, 24.** Real results
from six days ago. They should be re-run before anyone quotes them as today's.

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
  for a server that simply was not there. `audit:suite-base-url` now lints all 41
  browser scripts for this; it found three of the five on its first run, which is
  the case for automating the class instead of fixing the instances.

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
pnpm audit:design ; pnpm test ; pnpm typecheck ; pnpm lint

# needs the server
pnpm audit:filters ; pnpm audit:attendance-tz ; pnpm audit:payslip-exposure
node scripts/audit/qa-run-workflows.mjs          # 21 exercises
node scripts/audit/qa-workflow-assertion-index.mjs
node scripts/audit/qa-control-surface-census.mjs
```

The single authority on *what a feature does* is `docs/FEATURE_CHECKLIST.md`. This
matrix is the authority on *what has been checked*.