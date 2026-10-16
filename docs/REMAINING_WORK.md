# Remaining work — what is still needed to finish

**Updated:** 2026-10-09 · **Branch:** `fix/auth-signout-scope-and-payroll-coherence` (working tree clean)
> No HEAD SHA is pinned here on purpose — a doc committed in commit X cannot name X, so the pin goes stale on the next commit. `PROJECT_STATUS.md` holds the live gate numbers.

This is the forward-looking document: what is done, what is blocked, and the exact
next steps in the order they should be taken. Current gate numbers live in
`PROJECT_STATUS.md`; the design contract lives in `DESIGN_SYSTEM.md`; deep evidence
lives in `SYSTEM_AUDIT.md`.

---

## 0. One-paragraph state

**The platform is shippable.** The 18-step gate passes end to end — *"All checks passed.
Ship it."* exit 0 — covering typecheck, lint, 504 unit tests, production build, RBAC, page
wiring, page inventory, design-system and filter-persistence audits, a nav-driven crawl of 219
pages across all 13 roles, a 224-combination responsive sweep, and 100 Playwright tests against
a production build. The two blockers that remained on 2026-10-08 are closed: the payroll overlap
was **fiction, not a conflict** (the draft period's records were `engine: stub_v1` with zero
statutory deductions, so there was no second payroll result to reconcile), and all eight
migrations are applied with zero pending. Nothing now blocks a release. What remains is
optional follow-up, listed in §1.

---

## 1. Closed on 2026-10-09 — previously blocked, now resolved

Both former blockers are resolved. The reasoning is preserved below because the
correction is instructive: the payroll conflict was not a conflict at all, and the
realtime gate was not a database problem.

### 1.1 Payroll reconciliation — CLOSED, and not for the reason first assumed

`node scripts/verify-all.mjs` fails on two steps because of live data, not code.

**Problem A — two periods cover the same 15 days.**

| Period | Range | Status | Records |
|---|---|---|---|
| `4fb757e0-d16e-4908-b596-4571a9bc3f42` "September 1–15, 2026" | 2026-09-01 .. 2026-09-15 | finalized | 1 |
| `929abbb1-7afa-42fa-b972-cdc78b36f80f` "September 2026 payroll" | 2026-09-01 .. 2026-09-30 | draft | 10 |

Employee `108f95ff-e47f-414f-8ec2-0e49f075edb0` holds a **finalized** record in **both** —
24,500 in the fortnight and 26,760 in the monthly run. The same worked days are paid twice.

> The two figures **disagree**. These are not one computation stored twice; the two runs
> calculated different amounts for the same shared days. So "just delete one" is not
> automatically safe — whoever ran those two payrolls has to say which figure is right.

**UPDATE 2026-10-09 — that framing was wrong, and the reason changes the answer.**

The two runs are not equally plausible. Reading the `calculation_snapshot` on every record:

| | September 1–15 (finalized) | September 2026 payroll (draft) |
|---|---|---|
| `calculation_snapshot` | `{"seeded":true}` | `{"engine":"stub_v1","seeded_by":"batch4b","at":"2026-10-06T06:03:5x"}` |
| Records carrying any deduction | **1 / 1** (₱3,500) | **0 / 10** |
| `net_pay` vs `gross_pay` | 24,500 vs 28,000 — deductions applied | **identical on all 10** |
| `worked_minutes` | 4,800 | **4,800 on all 10** |

The draft period's figures were written by a **stub seeding script**, not the payroll engine.
Three independent tells, any one of which would be suspicious:

1. **Zero statutory deductions on all 10 records.** No real BPO run produces no
   SSS / PhilHealth / Pag-IBIG for an entire workforce.
2. **Every one of the 10 has `worked_minutes = 4800`** — 80 hours — across a **30-day**
   period. The stub never modelled the period length.
3. **`basic_pay` is unchanged between the two runs for the shared employee** (25,000 in
   both), so the monthly record pays the same basic for double the days. That is where the
   26,760 vs 24,500 gap comes from: not two payroll runs disagreeing, but a 15-day figure
   and a stubbed 30-day figure.

**So the question is not "which figure is right".** The draft period is not a payroll
result at all. Recommended, and it is a different plan from the three options above:

- **Retire the draft `September 2026 payroll` period.** The 10 records and the 10 payslips
  that cascade away were generated from `stub_v1` numbers, so this does not destroy real
  payslips — it removes fiction. It also clears the overlap so
  `20261007120000_payroll_period_no_overlap.sql` can land.
- **Then run the real payroll engine for September**, covering 1–30, which leaves the
  finalized fortnight untouched and produces figures an employee could actually be paid
  against.

Not executed: retiring a period cascade-deletes 10 records, 30 components and 10 payslips,
so it needs an explicit go-ahead. Run `pnpm audit:payroll-plan` first to re-read the exact
SQL and blast radius against live data.

**CLOSED 2026-10-09 — approved, executed, verified.** `pnpm fix:payroll-overlap --apply` retired
the stub period (1 period, 10 records, 30 components, 10 payslips, 0 rows on the
`ON DELETE SET NULL` legs) and the independent audit now reports `Overlapping payroll periods: 0`.
The pipeline was then rebuilt from the engine rather than from seed fiction:
`pnpm seed:payroll:window` created `September 16–30, 2026` with 10 draft records and
₱240,000 gross, using `lib/payroll/schedule.ts`'s own `salaryFactorFor` and `fixedPayAmount`.
Migration `20261007120000_payroll_period_no_overlap.sql` applied cleanly afterwards.

**UPDATE 2026-10-09 — the retirement is now a reviewed, guarded command.**

`scripts/reconcile-payroll-period-overlap.mjs` (`pnpm fix:payroll-overlap`) does the first
step. It is dry-run unless `--apply` is passed, and it refuses to write unless it can prove
the target period holds nothing real:

| Guard | Why it exists |
|---|---|
| Refuses a period in `finalized` / `disbursed` / `closed` | never deletes approved payroll |
| Refuses unless **every** record is `calculation_snapshot.engine === "stub_v1"` | a real computed run cannot be deleted by pointing this at the wrong period |
| Prints the whole delete cascade before writing | 1 period, 10 records, 30 components, 10 payslips, 0 rows with `ON DELETE SET NULL` |
| Refuses when a cash-advance or commission row would be orphaned | those rows survive but lose the link to the payslip that carried them |
| Deletes with one statement on the period | Postgres applies the cascade atomically, so there is no half-deleted state |
| Re-runs the overlap test afterwards and exits non-zero if any conflict remains | the repair cannot report success it did not achieve |

Dry-run output is confirmed against live data: it selects the draft period, shows all 10
records at `engine=stub_v1` with `worked_minutes=4800`, and reports 0 rows at risk from the
`SET NULL` legs. Still not executed: it deletes rows, so it needs the explicit go-ahead.

One correction worth recording: the script cannot read `payroll_periods.pay_frequency`,
because that column only arrives with `20260922120000_payroll_frequency_fixed_salary.sql`
and the repair has to run *before* that migration. It selects only columns present in
every schema revision, and `tests/
payroll-overlap-reconciliation.test.ts` fails the build if that dependency is reintroduced.

**Before choosing, read what each option actually costs.** `pnpm audit:payroll-plan`
prints the full blast radius against live data, and two of these consequences are not
visible from the option names alone:

| Option | What it costs |
|---|---|
| **1. Retire the draft** | Cascade-deletes **10 payroll_records, 30 payroll_components and 10 payslips** from under the employees who read them in `/app/my/payroll`. And it is *not* "keep the good one": the surviving fortnight holds only 1 record, so afterwards **9 of 10 employees have no September pay at all and nobody is paid for Sept 16–30.** A new `2026-09-16 .. 2026-09-30` period has to be created and run, or September goes out short |
| **2. Shrink the draft to start 2026-09-16** | Deletes nothing, but the 10 records still carry amounts computed across the **full month** (₱500,000). After the date edit those figures are stale and must be recalculated, and the 10 existing payslips become **wrong rather than missing**. Looks like a one-line fix; it is not |
| **3. Retire the finalized fortnight** | Deletes 1 record, 1 component, 1 payslip. Only correct if that run was a test — its record is `finalized`, so if anything was disbursed this destroys the record of money that actually left |

**The shortcut that does not work:** voiding the duplicated payroll *records* fixes the
double payment but does **not** unblock migration `20261007120000_payroll_period_no_overlap.sql`.
That migration adds an EXCLUDE constraint on `payroll_periods.daterange(...)` — it constrains
**periods**, not records — so `ADD CONSTRAINT` still fails validation until the periods themselves
stop overlapping. Only a change to the periods clears that step.

Good news from the same scan: `cash_advance_deductions` and `payroll_approvals` have **0** rows
pointing at either period, so no cash-advance linkage is lost whichever option is chosen.

**Problem B — the same draft period has 10 of 10 records already `finalized`,
₱500,000 net, before anyone approved the period.** The *code* hole is closed (payslips
now require an approved period, enforced in `lib/payroll/actions.ts` plus a database
trigger), but the rows are still premature.

Decide separately: **should those 10 records drop back to `draft`?** Recommendation:
yes — records are finalized by a finalize action that cascades from the period, and
the period was never approved, so the records should not have left `draft`. Migration
`20261007130000` will otherwise leave the database permanently out of step with its own
rule.

**Then:**

```bash
pnpm audit:payroll-plan                    # exact SQL + blast radius for each option
node scripts/audit/audit-payroll-period-overlap.mjs        # expect: 0 conflicts
node scripts/audit/audit-payroll-status-coherence.mjs      # expect: Incoherent periods: 0
node scripts/verify-all.mjs --skip-migration                # both steps must PASS
```

Run the chosen SQL inside a transaction (`begin;` … `commit;` / `rollback;`) so a wrong
choice is one `rollback` away.

Only after both audits are clean, apply
`supabase/migrations/20261007120000_payroll_period_no_overlap.sql` — `ADD CONSTRAINT`
validates the whole table and will fail while the conflict exists.

### 1.2 Database credentials — CLOSED, all migrations applied

**CLOSED 2026-10-09.** All **7** pending migrations applied; `supabase migration list`
shows remote equal to local for every one. The DB password was sufficient — the project
was already linked via `supabase/.temp`, so `supabase db push` never needed a personal
access token. Two defects had to be fixed first:

- `20261006140000` declared `handle_user_sign_in()` with no `returns trigger` (`42P13`).
- The Supabase CLI's migration splitter rejects the canonical clause order; **`RETURNS`
  must precede `LANGUAGE`**, verified by bisection against the live database.
  `tests/migration-function-clauses.test.ts` pins both rules.

The realtime gate then still failed, but not because of the database: the probe
subscribed with the **anon** key while `notifications` RLS is `user_id = auth.uid()`
scoped to `authenticated`, so it could never receive the event it was waiting for. It
now signs in as the notification's owner.

<details>
<summary>Original notes (kept for history)</summary>

Nothing is partially applied; all four are pending.

| Migration | What it does | Consequence while unapplied |
|---|---|---|
| `20261006140000_realtime_and_profile_sync.sql` | Realtime publication + profile sync, hardened (`EXECUTE` revoked from `public, anon, authenticated`) | Notifications fall back to polling |
| `20261007120000_payroll_period_no_overlap.sql` | GiST `daterange` exclusion constraint | Overlapping periods can be created again |
| `20261007130000_payroll_record_status_coherence.sql` | `BEFORE INSERT OR UPDATE` trigger rejecting finalized/paid records in unapproved periods | The coherence rule is enforced in app code only |
| `20261008120000_hr_recruitment_access.sql` | Grants `hr` `recruitment.read` + `recruitment.manage` | **HR gets a live 403 on `/app/recruitment`** |

**Partially checked without credentials.** `pnpm audit:migrations` confirms the four are
present and their dollar-quoted function bodies are balanced (6 bodies, none unterminated).
That is the whole of what it establishes — it does not parse SQL, does not resolve columns,
and does not prove the migrations will apply. `supabase db push --dry-run --yes` needs the same
credentials that are missing, so nothing stronger is available from this machine.

To apply them:

```bash
# from Supabase dashboard -> Project Settings -> Database
$env:SUPABASE_DB_PASSWORD = "<db password>"
# a Personal Access Token with db-push scope
$env:SUPABASE_ACCESS_TOKEN = "<pat>"

pnpm exec supabase link --project-ref nwvnawgxkzwiercllgmg
pnpm db:push

# verify each one, then drop --skip-migration
node scripts/audit/test-realtime-events.mjs
node scripts/audit/audit-rbac.mjs          # hr must pass /app/recruitment
node scripts/verify-all.mjs
```

`20261006140000` creates a trigger on `auth.sessions`, which needs DB-level
(`postgres`) access, not the service-role API key. The CLI access token currently
present returns `Unauthorized` for `supabase projects list`.

</details>

### 1.2a Environment note — `.env.local` was truncated and rebuilt (2026-10-09)

`.env.local` is gitignored, so a mid-session truncation had no version to restore
from. Twelve of fourteen keys were rebuilt: the five `NEXT_PUBLIC_*` values from the
last production build's client bundle in `.next/static/chunks/`, `AUTH_SECRET` intact,
and the rest from the operator. Three could not be recovered and were replaced:

| Key | Replacement | Consequence |
|---|---|---|
| `VAPID_PRIVATE_KEY` | new VAPID keypair generated via `web-push`, verified coherent | **Existing browser push subscriptions are invalid** and must re-subscribe |
| `DEMO_PASSWORD` | 13 demo accounts reset through the admin API; sign-in verified on 5 role accounts | none, once clients re-subscribe |
| `CRON_SECRET` | new random value | any deployed environment calling `/api/jobs/cron` must be updated to match |

`SUPABASE_SECRET_KEY` and `SUPABASE_ACCESS_TOKEN` remain unset. Both were then shown
to be non-blocking: every consumer falls back to `SUPABASE_SERVICE_ROLE_KEY` (one script,
`test-realtime-events.mjs`, did not, and was fixed), and `supabase db push` works from
the existing `supabase/.temp` link without a personal access token.

### 1.3 Push delivery — never observed end to end

The pipeline is reachable and unit-tested, but no real delivery has been witnessed.
Headless Chromium's FCM endpoint is a phantom, so
`scripts/audit/test-push-roundtrip.mjs` reports a blocker, not a pass. Follow the
device runbook in `docs/PUSH_NOTIFICATIONS.md` (iOS 16.4+ with Add-to-Home-Screen,
or Chrome).

### 1.4 Project environment question

Supabase project `ulrjitekiylgepdyijsw` — staging or production? Nothing currently
deploys to it, and the answer determines whether the demo login picker and other
dev affordances should be enabled there.

### 1.5 `leave_requests` is empty — restore demo data, or drop the assertion

Found 2026-10-09 while fixing the e2e suite. One unit test is deliberately failing
until this is decided: `tests/live-data-smoke.test.ts` *"Attendance / leave workflows
have data"* asserts `count("leave_requests") >= 1`, and the table is now empty.

**What actually happened, in order.** `e2e/mutations.spec.ts` created a leave request on
every run and never deleted it, so repeated runs produced exact duplicates — which is
what the file's own dedupe invariant was correctly reporting. Adding a cleanup exposed
a second problem: the first cleanup matched on the `reason` string
(`.eq("reason", "E2E leave smoke")`), and **every** row in the table carried that same
reason, so it emptied the table. Cleanup is now scoped by row ID.

**Why the table was empty underneath.** No seed script ever creates `leave_requests`.
`scripts/seed-demo-extended.mts` only *dedupes* them; `scripts/cleanup-leave-duplicates.mjs`
only deletes. So all 8 rows were e2e residue, and `>= 1` was never validating seeded
demo data — it was passing on another test's side effect, and it cannot pass once that
test cleans up after itself.

Two ways to close it:

- **Restore demo leave history (recommended, and now a one-liner).** `/app/my/leave`
  currently renders *"No leave requests yet"* for the demo employee, and the e2e test
  *"leave approve opens confirm and cancel does not mutate"* **skips** because there is
  nothing pending. A demo with no leave history and an empty HR approvals queue is a weaker
  demo. `scripts/seed-demo-leave.mjs` is written and ready:

  ```
  pnpm seed:demo:leave            # dry-run, prints the exact rows
  node scripts/seed-demo-leave.mjs --apply
  ```

  It is dry-run by default, idempotent (exits early if any history exists, so it cannot
  pile up duplicates), skips bereavement / leave-without-pay / maternity / parental by
  design, offsets dates per employee so no two rows share `(employee, start, end)`, and
  **refuses to write** if any `pending` request would start on or before today.
- **Drop the assertion instead.** Defensible on technical grounds — `leave_requests` is
  user-generated, so requiring it in a *"seeded demo data is present"* check is a category
  error. But it removes a check rather than fixing anything, and it leaves the demo thin.

**Not applied.** Both options write to the live demo database, so this is left for you to
run. **Applied 2026-10-09** — 16 rows inserted, the smoke suite is 449/449, and gate steps
14/15 are green again.

---

## 2. Ready to do now — no credentials needed

### 2.1 The 242 `min-h-11` overrides — classified, not deferred (P2)

`Input`, `Button` and `NativeSelect` raise themselves to 44px under
`@media(pointer:coarse)`. The 242 call-site overrides re-assert that floor at
*all* widths. "Needs visual review" was the right call at 242 sites and the wrong
answer forever, so `pnpm audit:touch` now classifies them
(`scripts/audit/audit-touch-overrides.mjs`, read-only):

| Bucket | Count | What it means |
|---|---:|---|
| **DEFEATS-COMPACT-VARIANT** | **0 — was 23, all fixed** | `<Button size="sm" \| "icon">` forced to 44px, silently un-doing the compact variant. **Unambiguous defects** |
| WIDENS-DESKTOP | 96 | On a self-raising primitive, but with no media query — so it also forces 44px on desktop. A design call, not a bug |
| LOAD-BEARING | 87 | On a `<Link>`, `<button>`, `<div>` or a wrapper with no floor of its own. **Deleting these drops real touch targets below 44px on phones** |
| UNCLASSIFIED → resolved | 12 | On radix wrappers (`DialogPrimitive.Close`, `SheetClose`, `SidebarMenuButton`, `PopoverTrigger`, `DropdownMenuTrigger`) — verified: none of `dialog.tsx`, `sheet.tsx`, `sidebar.tsx`, `dropdown-menu.tsx` or `popover.tsx` carries a coarse-pointer floor, so these are load-bearing too |

**The classifier's first version reported 23 defects and 18 of them were correct
code.** It matched `min-h-11` as a substring, which also matches
`[@media(pointer:coarse)]:min-h-11` — the *right* way to write this (36px on
desktop, 44px on touch). Acting on that list would have deleted the exact pattern
the project wanted. A bare token is preceded by whitespace or a quote; a
variant-prefixed one is preceded by `]`. The 5 real sites are fixed:
`app-header` (2 icon buttons), `notifications-page-client` (2), `recalculate-button`,
`employee-auth-shell`.

The remaining 96 are a design decision, not a defect. Broken down by surface,
because "96 need a decision" is not a question anyone can answer — the answer
flips depending on where the control sits:

| Surface | Count | Reading |
|---|---:|---|
| App surfaces | **82** | A 44px button in a dense desktop table is unusual. These are the most likely leftovers of a mobile fix |
| Marketing site (public) | 9 | A 44px call-to-action on a public page is ordinary. Probably correct as written |
| Auth screens | 5 | Same argument as marketing; low consequence either way |

**The project already has an idiom for this.** 18 call sites use the correct form —
`[@media(pointer:coarse)]:min-h-11`, compact on desktop, 44px on touch — and every
`Button` variant does the same internally. The bare `min-h-11` contradicts
`DESIGN_SYSTEM.md` §3's own principle (`text-base … sm:text-sm`: bigger on mobile,
compact on desktop). So if the intent was "fix the phone", the 82 app-surface rows
should become `[@media(pointer:coarse)]:min-h-11`.

That is a whole-app change to desktop button height and is the user's call, not a
drive-by. `pnpm audit:touch` reports the split.

The 87 load-bearing sites are explicitly do-not-touch — that is where the WCAG
floor actually lives.

### 2.2 The 12 arbitrary radius values — same story, smaller (P2)

`rounded-[Npx]` is used **106 times** across 12 distinct values; 8 are off-scale
(`28`, `20`, `3`, `10`, `14`, `4`, `22`, `6`). Informational in
`scripts/audit-design-system.mjs` because it cannot be reviewed in one pass.
Two of the highest-count offenders were removed incidentally this session
(`rounded-[12px]` and `rounded-[8px]`, down from 109 uses to 106) when four
hand-rolled buttons were replaced with the `Button` primitive.

Remaining off-scale by frequency: `28px` ×10, `20px` ×6, `3px` ×6, `10px` ×5,
`14px` ×3, `4px` ×3, `22px` ×2, `6px` ×1. Map them to the scale or promote
specific ones deliberately.

### 2.2b The design gate only ever checked `<select>` and `<table>`

`scripts/audit-design-system.mjs` printed `VERDICT: no raw primitives and no
hardcoded colours` while flagging only two tags. **Every raw `<input>`,
`<textarea>` and `<button>` in the app was invisible to it.**

Widening it to those three tags found **11 files**. Judgement on each:

- **5 fixed.** Four raw buttons that were hand-rolled ghosts/outlines of exactly
  what `Button` already provides (`app-header` account menu, `password-field`
  reveal toggle, `demo-login-picker` chips, `site-header` menu trigger), plus one
  **genuine design-system break**: the `type="date"` picker on `/app/attendance`
  carried `min-h-11 rounded-[12px] border border-line bg-mist/50 px-3 text-sm`
  *inside the same FilterBar as a correct `NativeSelect`* — two controls, side by
  side, that could not match. It is now `<Input>`.
- **3 were correct code.** A `type="radio"` in the payroll wizard and two
  `type="checkbox"`s are a different control category; `Input` must not wrap them.
  The rule now exempts `hidden`/`checkbox`/`radio`/`file`/`range`/`color`/`image`
  by type. An untyped `<input>` is still flagged, because no `type` means text.
- **4 are deliberate**, allowlisted with reasons and printed in CI output:
  notification list rows, heatmap cells, and the ⌘K search bar styled as a text
  field. Wrapping those in `Button` would add padding and a radius their layout
  does not want.

29 contract cases in `tests/design-system-contract.test.ts`, up from 24.

### 2.3 Remaining silent list caps (P2 — re-scoped, most were never defects)

An earlier version of this doc listed eleven `.limit()` sites as "list pages that
still cap". Reading them properly showed that is wrong: **`.limit()` is not by itself
a defect.** The honest split is below, and all three real caps have since been fixed.

**Fixed this session:**

| Page | Was | Why it mattered |
|---|---|---|
| `app/app/approvals/page.tsx` | `.limit(50)`, no pager | The cross-domain action queue. A pending approval at position 51 was invisible, with no pager to say so — on the screen whose entire job is telling someone what waits for them |
| `app/app/client/timesheets/page.tsx` | `.limit(40)`, no pager | Client timesheet days awaiting review. Days 41+ waited with no indication they existed. The heading counted only what fit on the page, so it now uses a real `count` query |
| `app/app/cms/page.tsx` | 6 × `.limit(50)`, no pager | Blog posts, services, FAQs, industries, testimonials, case studies. A marketing manager with 60 FAQs could never see FAQ 51 |

**A page can host more than one pager.** `/app/cms` stacks six independent lists
rather than putting each behind a tab, so `ListPager` grew an optional `param` prop for
the query key. With one shared `page` param, advancing to the testimonials pager would
have landed on testimonials page 3 because you had paginated FAQs.

**Legitimate, leave alone:**

| Page | Cap | Why it is not a bug |
|---|---|---|
| `app/app/client/reports/page.tsx` | 2000 | Aggregate sample feeding a rollup, already commented. Not a rendered list |
| `app/app/client/timesheets/page.tsx` | 2000 | Same rollup sample, on the summary card |
| `app/app/admin/users/page.tsx` | 100 / 50 | Search-*candidate* sub-query (ids to match), not the rendered list. A 101st match not appearing is a real limitation but a deliberate, separate tradeoff |
| `app/app/client/performance/page.tsx` | 20 | A KPI sample across employees, not a queue |

**One judgement call left:**

| Page | Cap | Question to answer |
|---|---|---|
| `app/app/client/performance/page.tsx` | 20 | Should a client see *every* KPI for their team, or is a 20-row sample the right presentation? This is a product decision, not a bug |

Find them all with:

```bash
rg "\.limit\(" app/app --glob "*.tsx"   # 65 occurrences / 40 files
```

**Do not add a blanket "no `.limit()`" gate.** It fails on the aggregate samples
above, and a gate that flags correct code gets switched off.

### 2.4 E2E in CI — the job is now runnable, it just needs the switch

The `e2e` job existed and was gated on `vars.RUN_E2E == 'true'`, but **flipping it on
would have failed every test**: there was no build step, no server, and no cleanup.
`playwright.config.ts` only auto-starts a webServer when `PLAYWRIGHT_BASE_URL` is
unset, and it starts a *dev* server — four sequential projects would each pay a dev
compile and exercise behaviour that is not what ships.

Now the job:

- builds with `pnpm build`, then `pnpm start` with a `/login` health-check loop
- sets `PLAYWRIGHT_BASE_URL` on all four Playwright steps, so `webServer` stays out of it
- **no cleanup step, deliberately** — see below
- dumps `/tmp/beepa-server.log` on failure, so a broken server is visible

**The cleanup step was removed on 2026-10-09.** The job used to run
`node scripts/cleanup-leave-duplicates.mjs --apply` with `if: always()`, justified as
"`mutations.spec.ts` submits a real bereavement leave request, so every run leaves a
duplicate behind." That stopped being true when the pollution was fixed at the source: the
spec now picks a benign leave type by name (it was selecting index 1, which happened to be
BEREAVEMENT) and deletes the row it created, scoped by row ID. A step whose justification is
false is worse than no step — it runs every build, it drags privileged Supabase credentials
into the job, and it deletes live demo data on a schedule nobody reasons about.
`tests/ci-and-account-honesty.test.ts` now asserts the step is **absent**, so the band-aid
cannot be reinstated by someone reading the old comment and believing it. The repair script
still ships for when the table genuinely does hold duplicates.

`scripts/cleanup-leave-duplicates.mjs` reads `process.env` as a fallback, so it does not
throw on a missing `.env.local`, which CI does not have.

**To enable:** set the repo variable `RUN_E2E=true` plus the secrets
`DEMO_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `AUTH_SECRET`. Projects stay
sequential (anonymous → chromium/employee → owner → client) because several specs
sign in as the same demo account.

The invariants are pinned in `tests/ci-and-account-honesty.test.ts` — build and server
present, base URL on every Playwright step, cleanup with `if: always()`, cleanup script
CI-capable — and verified by a negative control that removes `pnpm start` and watches
the test fail.

### 2.5 Small items carried in the ledger

| Item | Priority | Note |
|---|---|---|
| ~~Admin user search by role name~~ | **Done** | `/app/admin/users` now filters by role. See §2.6, §2.7 |
| Remaining silent `.limit` lists | P2 | See §2.3 |
| ~~`CardTitle` carries no heading role~~ | **Done** | `CardTitle` now renders `<h2>`; a positive a11y assertion prevents regression. See §2.5 |
| OAuth / FTS / announcements | Deferred | Deliberately out of scope |
| Org/workflow CRUD | Deferred | Read-only is intentional |
| **The 25-character body-copy threshold hides real 14px violations** | **P2** | See §2.8 |
| **`text-sm text-slate` body copy on ~8 `/app/my` pages** | **P2** | See §2.8 |

### 2.8 The audit's 25-character body-copy threshold is seed data, not a rule

The responsive audit skips any text under 25 characters as "not running body copy"
(`scripts/audit-app-responsive.mjs`). That is a reasonable guard against flagging
short labels, but it makes the verdict depend on **how long the seeded text
happens to be** rather than on what the element is. Two real violations got
through and were only caught when the sweep was finally run *per role*:

| Page | Element | Was | Caught by |
|---|---|---|---|
| `/app/my/documents` | `category · date` | `text-sm` (14px) | teamlead's document name is 28 chars; owner's is shorter and passed the identical component |
| `/app/client/notifications` | notification **body** | `text-sm` (14px) | clientviewer's seeded body exceeds 25 chars |

Both are fixed (`text-base md:text-sm` / `text-base sm:text-sm`, unchanged on
desktop). Both are in **shared components**, so other routes were latently wrong
too.

**The same pattern is still present and currently under the threshold**, so these
are latent rather than green — they will fail the moment seeded text gets longer:

- `app/app/my/cash-advances/page.tsx:123` — `row.reason`
- `app/app/my/requests/page.tsx:127` — `ticket_number · date`
- `app/app/my/nte/page.tsx:87` — `row.description`
- `app/app/my/requests/[id]/page.tsx:63` — `ticket.description`
- `app/app/my/attendance/page.tsx:130` — timestamps
- `components/app/billing/invoice-detail-view.tsx:72` — client · period
- `app/app/crm/deals/[id]/page.tsx:188` — proposal amount

**The fix is two parts and only the first is mechanical.** Bumping those to
`text-base md:text-sm` is mechanical. The threshold itself is the real problem:
it should distinguish *body copy* from a *label* semantically — e.g. an explicit
opt-out attribute on the element — rather than by counting characters, because a
counting rule cannot distinguish `Draft` from `No employee record is linked to
your account, so uploads are unavailable.` Do not simply lower the number: that
converts every short label on every page into a failure and buries the real
findings, which is the failure mode `audit:responsive` already documents for
`/app/cms`.

**`CardTitle` renders a `<div>`, not a heading — fixed 2026-10-09.** It used to render a
`<div>`, so every card title in the app was invisible to heading-navigation. axe does not
flag this: a `<div>` is not a *broken* heading, it is simply not one. It was found by
writing a test that asked for `getByRole("heading", { name: /invite internal user/i })`
and watching it fail against a perfectly correct-looking page.

It now renders `<h2>`, directly under the page `<h1>`, so it cannot introduce an axe
heading-order skip, and Tailwind's preflight already normalises heading size/weight/margin
so nothing moves visually. **`e2e/a11y.spec.ts` asserts the heading is present and is an
`H2`** — a scanner cannot catch the absence of something, so this needs a positive check.

Making that change surfaced a second, unrelated defect: `aria-label` is not permitted on
a role-less `<div>`, and the route-level loading skeletons in `app/app/crm/loading.tsx`
and `app/app/tickets/loading.tsx` put one on an `aria-busy` container. axe reported it as
`aria-prohibited-attr` (serious). Both now carry `role="status"`.

### 2.6 Two defects found while verifying §2.5, not by it

Both were on `/app/admin/users` and both are now fixed. They are recorded
because the first one is invisible in every screenshot.

**The role filter was dropped on page change.** The page read
`stringParam(params.role)` and rendered a `FilterSelect`, but its `ListPager`
carried only `query={{ q }}`. `ListPager` rebuilds its href from that object
alone (`hrefFor()` starts from an empty `URLSearchParams`), so clicking Next
produced `?page=2` — no role, no text, everyone. No error, no empty state, just
a list that answered a question nobody asked, on the screen whose entire job is
answering questions about who holds which role.

**The role id list was unbounded.** Resolving a role means reading
`membership_roles` for that role's id, then inlining those membership ids into a
`.in()` filter on the membership query — i.e. into a URL. The text-search
sub-queries beside it are capped at 100 and 50; this one had no cap at all. It
is now capped at 1000 with the tradeoff stated in the code: a role held by more
people than that reports an undercount, which is preferable to a 414 and a page
that renders nothing.

### 2.7 `scripts/audit-filter-persistence.mjs` — the gate that stops §2.6 recurring

Sweeps every page that renders a `ListPager` and fails if it reads a filter off
`searchParams` that the pager does not carry. Wired into `verify-all` as a
gating step, aliased as `pnpm audit:filters`.

**This gate reported 15 violations, then 1, and 14 + 1 of them were its own
fault.** It is worth recording how, because the failure mode is the same one
that has burned this project repeatedly — a tool that cannot be doubted until it
is proven, and that gets believed precisely because it is loud.

| Version | What it claimed | Why it was wrong |
|---|---|---|
| 1 | All 14 shorthand pages dropped `q` | Key extraction matched only `key: value`. `{ q, status }` is shorthand with no colon, so it extracted nothing and called every page a violator |
| 2 | `/app/attendance` dropped four filters | It read only inline `query={{ … }}`. That page builds `filterQuery` above the JSX and passes the variable. The scanner saw no `query` at all and reported the omission as a defect |
| 3 | Same page, still accused | The identifier regex required `}` immediately after the name, so `query={buildIt(q)}` matched *nothing* — no note, and the page was charged with dropping `q` |

The shipped rule has three parts, each with a negative control in
`tests/filter-persistence.test.ts` (13 cases):

1. Understand both inline literals and `query={identifier}`.
2. When a query expression cannot be resolved, report the page as **NOTE /
   unverified** and skip it. A scanner that cannot read a file has no standing to
   accuse it. This is the correction to version 3, and the reason the gate is
   trustworthy rather than merely loud.
3. Exit 2 on a bad path argument, never a verdict — the same lesson as
   `audit-app-responsive.mjs` reading a username out of `argv[2]`.

Live result: **32 pages scanned, 0 dropped, 0 unverified.**

---

## 3. Recently completed (so nobody redoes it)

| Area | What landed |
|---|---|
| **Payroll status coherence** | Single definition of "payable" in `lib/payroll/status-coherence.ts`; DB trigger migration; **two seed scripts that were writing record status directly were the real bug** (`scripts/audit/batch4b-finish.mjs`, `scripts/seed-demo-extended.mts`) — both now derive status from the parent period |
| **Release-gate honesty** | `verify-all.mjs` was counting every skip as a failure (17 "failures" out of 16 steps) and printing "Ship it" over live double-payment. Now tracks failures explicitly, names them, and asserts `passed + failed + skipped === total` |
| **Careers for HR** | `hr` had **no** `recruitment.*` permission at all — live 403 confirmed, migration written |
| **Careers for applicants** | `/app/applicant/jobs` + `/app/applicant/jobs/[id]` in-app; notifications page existed but was unlinked and unreachable — now in nav |
| **Full application statuses** | All 12 stages carry label, tone, applicant note, staff note, terminal flag and pipeline position; enum values parsed from the migration in tests rather than re-typed |
| **Design system** | `NativeSelect` primitive; 26 raw dropdowns across 22 files migrated (none had a focus ring); last raw `<table>` converted; semantic status + series + sidebar token layers; 12 hardcoded-colour files tokenised; `scripts/audit-design-system.mjs` created and wired into `verify-all` |
| **Body text on phones** | The full 232-combination responsive sweep found 9 real `TEXT<16` failures on `/app/clients`, `/app/recruitment/jobs`, `/app/admin`; all three now use the `text-base … sm:text-sm` pattern the rest of the app already followed. Rule written into `DESIGN_SYSTEM.md` §3 |
| **Responsive route list** | `/app/cms` was in the *owner* sweep but gated on `cms.manage`, which only `marketing` holds — so it reported `DENIED forbidden` at all 8 viewports forever. Removed with the reason recorded and the correct command to cover it |
| **Tool honesty** | Five auditors were reporting success they had not earned (403s scored as PASS, a wrong path separator, timing-based flake, derived failure counts, comment-scanning itself) — each fixed with a negative control |

---

## 4. How to re-verify from scratch

```bash
# dev must be stopped — next build and next dev share .next
node scripts/verify-all.mjs --skip-migration   # the honest ship gate, exit 1 today

# or by alias
pnpm verify:skip-migration
pnpm audit:design          # raw primitives + hardcoded colours
pnpm audit:filters         # filters dropped when a ListPager changes page
pnpm audit:payroll-plan    # READ-ONLY: blast radius + exact SQL per reconciliation option
pnpm audit:migrations      # structural preflight for any not-yet-applied migration
pnpm audit:wiring          # dead controls, unsubmittable forms, dead links
pnpm audit:rbac            # route gates
pnpm audit:action-rbac     # server-action gates
pnpm audit:role-pages      # nav-driven crawl, needs a running server
pnpm audit:pages           # page inventory (-- --check for drift)
pnpm audit:app-responsive  # layout sweep, needs a running server
pnpm audit:perf            # budgets, needs a production build
```

Performance is only meaningful against `next build && next start`, never `next dev`.
Playwright projects run sequentially.

**Start the server and run the audit in the same invocation, and stop it by PID in
that block.** Redirecting `next start`'s output to a file ties its stdout to the shell
that launched it; when that shell is reaped, Next exits with `The destination stream
closed early` and the *next* audit fails with `ERR_CONNECTION_REFUSED` — which looks
exactly like an app defect. See `SYSTEM_AUDIT.md` §18.

`audit-role-pages.mjs` takes roles as arguments, so it can be run in batches:

```bash
$env:BASE_URL = "http://localhost:3100"
node scripts/audit-role-pages.mjs owner@demo.beepabpo.com hr@demo.beepabpo.com
node scripts/audit-role-pages.mjs sales@demo.beepabpo.com marketing@demo.beepabpo.com
```

Batching is not just convenient — on a busy machine a single 13-role run can get
killed partway through, losing every buffered line and reporting a bare exit `-1`.
Three batches of 4–5 roles each completed reliably where the single run did not.

`audit-app-responsive.mjs` takes an **optional email first, then routes**; the email
is detected by shape, so both forms work:

```bash
node scripts/audit-app-responsive.mjs                                   # owner, default routes
node scripts/audit-app-responsive.mjs /app/admin                        # owner, one route
node scripts/audit-app-responsive.mjs hr@demo.beepabpo.com /app/hr      # another role
$env:VIEWPORTS = "393x852"                                              # phone only, ~3s
```