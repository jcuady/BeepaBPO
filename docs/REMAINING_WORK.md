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

#### 2.2b-1 The type exemption is also blind to *styling* drift on those elements

The widening stopped one step short, and the residual gap is recorded here rather
than closed, because closing it properly needs a judgement the scanner cannot make.

`NON_TEXT_INPUT_TYPES` exempts `checkbox`, `radio`, `file`, `range`, `color`,
`image` and `hidden` **by type**. That answers one question — "is there a primitive
for this control category?" — and for a checkbox the honest answer is about
*submitting*, not about looks. `components/ui/checkbox.tsx` exists and is used
correctly by `login-form.tsx` for "Remember me", which is state-driven and submits
nothing. But the signup terms box is a native `required` field: swapping it for the
Base UI `Checkbox` would break form submission, because that primitive is a
`button role="checkbox"`. So the signup exemption is **correct code**, and the
payroll wizard's `type="radio"` likewise.

The gap is that the exemption is blind to everything *else* about those elements.
Found by sweeping the same way §2.2b found its eleven: `ticket-sla-policy-form.tsx`
carried `className="size-4 rounded border-line"` — a **4px corner radius on a
square-brand product**, at 16px where its sibling in the same auth flow renders at
20px through the primitive. Invisible to the gate, because the exemption is keyed on
`type` and says nothing about classes.

**Fixed** (`size-5 rounded-none border-line`), aligning it with both the brand and
the login checkbox.

**No gate added, deliberately.** The obvious rule — "a raw checkbox may not carry a
corner radius" — is sound, but the *general* version cannot be written: deciding
whether a raw checkbox is a submitted native field or a controlled toggle needs to
follow state wiring across a component, and this repo's own rule is that a scanner
which cannot read a file has no standing to accuse it (the `audit-filter-persistence`
version-3 failure in §2.7 is exactly that mistake, made once already). A rule keyed
on `type` can only skip them all. Recorded as a known gap rather than papered over
with a check that would either be vacuous or wrong.

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
| **The 25-character body-copy threshold hides real 14px violations** | **P2, mostly closed** | See §2.8 — 4 body-copy sites fixed, 4 metadata sites now marked `data-meta` |
| **`text-sm text-slate` body copy on `/app/my` pages** | **Done** | See §2.8 |
| **8 registered checks still write no evidence file, and 6 matrix rows quote numbers from them** | **P2** | See §2.9 |

### 2.8 The audit's 25-character body-copy threshold is seed data, not a rule — mostly closed

The responsive audit skips any text under 25 characters as "not running body copy"
(`scripts/audit-app-responsive.mjs`). That is a reasonable guard against flagging
short labels, but it makes the verdict depend on **how long the seeded text
happens to be** rather than on what the element is. Two real violations got
through and were only caught when the sweep was finally run *per role*:

| Page | Element | Was | Caught by |
|---|---|---|---|
| `/app/my/documents` | `category · date` | `text-sm` (14px) | teamlead's document name is 28 chars; owner's is shorter and passed the identical component |
| `/app/client/notifications` | notification **body** | `text-sm` (14px) | clientviewer's seeded body exceeds 25 chars |

**Both defects are fixed**, and so is the rule that let them through.

**The four unambiguous body-copy sites** — a reason, a description, a message body
— are now `text-base md:text-sm`, unchanged on desktop:

- `app/app/my/cash-advances/page.tsx` — `row.reason`
- `app/app/my/nte/page.tsx` — `row.description`
- `app/app/my/requests/[id]/page.tsx` — `ticket.description`, `msg.body`

**The four sites that are genuinely metadata** keep their 14px and are now marked
`data-meta`, a semantic opt-out the audit honours *before* the length heuristic:
a ticket number and date, a clock time, an invoice client and period, a
proposal amount. Marking them is explicit and reviewable; a character count can
never make that distinction, and these lines are exactly the ones that would flip
to FAIL the day a client name or ticket number grew.

`tests/body-copy-meta-optout.test.ts` (4 tests) pins both directions — that the
four metadata lines are marked, that the body-copy lines are **not**, and that
each body-copy site still carries `text-base md:text-sm`. **Mutation-proved:**
marking `row.reason` as `data-meta` turns 2 of the 4 red, so the guard fires
rather than merely being present.

**What deliberately did not change: the 25-character rule itself.** It still
guards every unmarked short string, and it is still a heuristic. Removing it would
turn every short label on every page into a failure and bury the real findings —
the failure mode `audit:responsive` already documents for `/app/cms`. The
remaining shape of the problem is that `data-meta` is opt-in and therefore
incomplete by construction: a future metadata line that nobody marks still depends
on its text being short.

### 2.8a The demo tenant cannot reach a whole class of empty states — fixed, and now measured too

While fixing the sites above, a second and larger blind spot turned up. Six
paragraphs of explanatory body copy were sitting at 14px in the **"no employee
record"** branches of `/app/my/attendance` (×2), `/app/my/leave`,
`/app/my/requests`, `/app/my/support` and `/app/my/cash-advances`.

The rendered audit cannot see them, and the reason is not the 25-character rule:

- every demo account that reaches those pages **has** an employee record, so
  `employee ? <form> : <p>` always takes the form branch;
- `applicant` has no employee record, but RBAC stops it at `/app/applicant`, so
  it never reaches `/app/my` either.

So those pages measure clean for every one of the 7 roles in row 21c, and would
measure clean forever — **for the one user the message is written for**. The
audit proved the owner reaches `/app/my/attendance` at 390px with no finding,
which is the evidence that the owner has a record: had it rendered the 46-character
paragraph, the audit would have flagged it.

All six are now `text-base text-slate md:text-sm`, and each is pinned by a named
assertion in `tests/body-copy-meta-optout.test.ts` — **mutation-proved**:
reverting one to `text-sm` turns the suite red and names that exact site. So they
are not merely corrected by inspection; they cannot silently regress. What they
still are **not** is *rendered*, because no automated check in this repository can
produce that state today. Those are different claims and the distinction is
deliberate.

**The fix for the gap — CLOSED 2026-10-16 by `qa-probe-unlinked-employee.mjs`.**
The blocker recorded below was real, and the way round it was to stop seeding a
demo account and start **building the state**:

`scripts/audit/qa-probe-unlinked-employee.mjs` creates a throwaway auth user with
the admin API, gives it an `internal` membership and the `employee` role, and
deliberately **not** a row in `employees` — which is exactly the production
situation of an admin who has not finished linking the profile. It signs in, walks
five `/app/my` pages at 390px and 1440px, and asserts the empty state renders, the
page names itself, and body copy meets its floor.

- **It is not in `lib/demo/users.ts`,** so nothing is added to the public login
  page, no 14th address breaks `demo-login-picker.test.ts`, and no figure that
  reports "13 roles" moves. The earlier reasoning below was correct about the
  picker and wrong to conclude the state could not be built.
- **32/32 checks pass**, and the deletion of what it creates is asserted, not
  assumed.
- **Mutation-proven:** reverting `/app/my/cash-advances`' empty-state paragraph to
  `text-sm` turns exactly one check red — `14px "Link your employee profile to
  request a cash advance."` on phone (390px) — and 31 others stay green.

**Three things the first version of the probe got wrong, each caught by running
it rather than by reading it:**

1. It counted every `<p>` over 25 characters and failed **all five pages** on
   `14px "Search for a command to run..."` — the command palette's description,
   which lives in the app layout on every route. Excluding by
   `closest('[role=dialog]')` did not help: the palette has no such wrapper in the
   DOM. The fix is the **zero-size rect** check `audit-app-responsive.mjs` already
   uses — an element that painted nothing is not body copy whatever its role.
2. It asserted the 16px floor at **1440px** as well, and failed all five pages
   again. This repository's rule is "body text below 16px **on narrow screens**"
   (`audit-app-responsive.mjs`, line 13); `text-base … sm:text-sm` is 16px below
   640px and 14px above by design, and §2.8's own eight fixes were all
   `text-base md:text-sm` for exactly that reason. The probe had invented a
   stricter rule than the product holds. Per-viewport floors now: **16px on phone,
   no floor on desktop** — desktop is still measured and recorded per paragraph,
   because that is what surfaced the footer tagline at 12px.
3. It matched one phrase across all four branching pages and failed two of them for
   no reason except that their copy differs. The four say three different things
   ("Link your employee profile", "not linked to an employee record", "require an
   employee record"); an assertion that encodes one author's phrasing reports the
   phrasing as the requirement.

**And it corrected §2.8a itself.** This section listed **five** pages including
`/app/my/support`. `/app/my/support` has **no** `employee` branch at all — it
renders one unconditional paragraph that never mentions an employee record — so it
was never in this state and never needed to be. The real figure is **four pages,
five paragraphs**. It is still checked for legibility, which is worth having, but
it is not an empty state. A coverage claim that overstates its own scope is its
own defect, and the probe was written to find exactly this.

Until then, treat "every demo account that reaches `/app/my` has an employee
record" as an assumption the layout audits are silently resting on — now written
down, now guarded by a probe that builds the counter-state, and no longer an
assumption at all.

### 2.9 Eight registered checks write no evidence file, and six matrix rows quote numbers from them

`qa-run-all.mjs` states its own rule in a comment: *evidence: file this check is
expected to have written. A green check with no evidence file is a finding, not a
pass.* Ten of the thirty registered checks then set `evidence: null` — which does
not report the finding, it **declares the exemption**, and the rule goes quiet.

Two of those ten were fixed this session and immediately became the worst
offenders:

- **`role-pages`** — matrix "222/222 ✅ Verified today", ledger "219/219, re-run
  2026-10-09", and **no file at all**. The script ended at `process.exit` having
  written nothing. Re-measured: 222/222, so the matrix was right and the ledger
  was stale — but neither could be checked, and the reason they had drifted is
  exactly this. Now writes `role-pages.json`.
- **`server-fresh`** — the gate the entire behavioural suite refuses to run
  without, whose past verdicts could not be read back or dated against the build
  they described. Now writes `server-fresh.json`, including the unreachable case
  so "we did not measure" can never read as "nothing was wrong".

**Closed 2026-10-16.** All eight now write evidence, and the exemption is closed
rather than merely unused:

| Check | Evidence file | What it records beyond the verdict |
|---|---|---|
| `form-reset-defaults` | `form-reset-defaults.json` | every field that survives a reset, `scanned`/`withReset` denominators, `scanningFixture` |
| `suite-base-url` | `suite-base-url.json` | the drifted scripts and why, plus `httpScripts`/`checked` |
| `gate-coverage` | `gate-coverage.json` | `declaredCount`, and the gated / ungated / not-a-gate lists |
| `seo-metadata` | `seo-metadata.json` | per-URL title/description lengths and JSON-LD types |
| `performance` | `performance.json` | every measured row verbatim, plus the budget it was judged against |
| `payslip-exposure` | `payslip-exposure.json` | `unapprovedCount` and each refused status code |
| `attendance-tz` | `attendance-tz.json` | timezone, the **moving** fixture date, and the expected clock strings |
| `cron-smoke` | `cron-smoke.json` | the observed unauthenticated status and the dry-run flag |

Every one of them writes on its **failure** and **"cannot tell"** paths too, not
only when it passes. That is the half that was missing before: a gate whose
evidence file appears only on success records nothing about the defect it was
written to catch.

Three of these needed a correctness fix to produce an honest file rather than
just a file:

- **`seo-metadata`** read only `argv[2]`, so `QA_BASE_URL` was ignored — the one
  HTTP audit in `scripts/audit/` that could not be pointed at a preview by the
  documented convention, reporting localhost's clean run for a host nobody
  crawled. It now reads `QA_BASE_URL` first. It also **exited 0 on an empty
  sitemap**, printing `ALL CHECKS PASS` over zero URLs; that is now exit 2.
- **`payslip-exposure` is `clean` with `unapprovedCount: 0`.** The employee has a
  `draft` record, but it is not in `(finalized|paid|approved)`, so there was
  nothing unapproved to refuse and the refusal path was never exercised. That is
  now visible in the file rather than reading as a pass. It is a **vacuous
  clean**, not a defect, and it is labelled as one.
- **`attendance-tz` moves its fixture date** — it walks forward from 2026-09-15 to
  the first free day, and landed on 2026-09-18 this run. The date is recorded so
  two runs are not silently compared across different rows.

**The exemption is now closed by test, not by convention.**
`tests/audit-evidence-coverage.test.ts` (17 tests) fails if any check outside the
one named exemption declares `evidence: null`. **Mutation-proved:** setting
`cron-smoke` back to `evidence: null` turns it red and names `cron-smoke`.

That test also earned its keep by catching four defects in itself, all recorded
in the file because each is a trap worth not re-entering:

- Its first registry parser used a non-greedy `\{…\}` and matched **25 of 30
  rows** — five carry an `env: { … }` block and the match stopped at that inner
  brace. A parser that drops rows cannot find a missing field in them; it just
  does not see them. It now parses line-anchored and cross-checks its own count.
- A fixture helper returned a `read()` closure over a temp dir that a `finally`
  had already deleted, so three fixture tests failed with `expected null not to
  be null` while the gates were writing evidence perfectly. The read is now eager.
- A "failing path writes evidence" test asserted `generatedAt` specifically and
  failed on four files that were perfectly datable under `when`/`startedAt`. That
  was inventing a schema violation out of a naming habit — the
  confident-nonsense class — so three keys are accepted and no `check` field is
  demanded, because attribution already exists via the registry row.
- A "which gates guard their crash path" test counted `catch (` per file and got
  **two of five wrong**: a regex cannot tell a guard wrapping the whole run from
  one wrapping a single `await`. Deleted rather than made to pass.

Two further tests were written and then **deleted as unfireable**, which is the
point worth recording:

- "Evidence must not predate `.next/BUILD_ID`" was red on 21 of 29 files
  *permanently* — a build is newer than the evidence until you re-run the suite,
  and this repo rebuilds many times per pass. A gate red by construction teaches
  people to ignore red. Replaced with a 30-day staleness floor, which catches the
  failure that actually happens (a file committed once and never regenerated)
  without being red today.
- The crash-path test above.

**Known limit, recorded not asserted:** only `attendance-tz` wraps its browser work
in `try/catch`. The other four leave the *previous* run's file in place on a
mid-run crash — dated, parseable, describing a build that is gone. Closing it means
wrapping four scripts, which is a change to product-adjacent tooling and belongs
in its own pass.

#### 2.9a Giving a gate an evidence file is itself a hazard — a fixture run overwrote the real measurement

This pass **introduced** a defect and then found it, which is the only reliable way
this class is ever found. The moment `audit-suite-base-url.mjs` and
`audit-form-reset-defaults.mjs` began writing to `docs/evidence/`, every
planted-bad-input test that ran them against a one-file fixture began
**overwriting the repository's committed evidence with that fixture's result**:

| Evidence file | Committed value | What it should have said |
|---|---|---|
| `suite-base-url.json` | `httpScripts: 0, verdict: "unknown"` | `httpScripts: 60, checked: 58, verdict: "agree"` |
| `form-reset-defaults.json` | `scanned: 1` | `scanned: 28, withReset: 21` |

Both numbers were quoted in this repository's own matrix. Nothing flagged it: the
files parsed, carried a timestamp, and were newer than everything around them.

The cause was pre-existing and invisible — while the gates wrote nothing, a fixture
run that printed a verdict and exited was self-contained.
`tests/audit-gate-integrity.test.ts` ran them with `cwd: ROOT`, which was harmless
and became destructive the moment there was a file to write.

**Fixed on both sides**, because either alone leaves the trap open:

- The gates write **beside their input** (`ROOTS[0]`, which `--dir` names), never
  to `process.cwd()`.
- The two tests pass a disposable `cwd`.

**Two wrong fixes came first, and both are worth recording:**

1. `SCANNING_FIXTURE ? process.cwd() : ROOT` — reads like the fix and is not one.
   The caller is what controls the working directory; that is the entire problem. A
   test spawning from the repo root got the repo. Caught by the byte-comparison
   test, not by reading the code.
2. Deriving the absolute root by hand-stripping `URL.pathname`
   (`replace(/^\/([A-Za-z]:)/, "$1")`) — the well-known wrong idiom. It compiled,
   ran, and silently resolved to the wrong place on Windows. `fileURLToPath` is
   the correct API, and this repo sits under `OneDrive`, where a directory name
   containing `%` makes the regex wrong for a matter of when, not if.

The byte-comparison test is the one that earned its place: it runs the gate from
`ROOT` against a fixture and asserts the committed file is **byte-for-byte
unchanged**, which catches both wrong fixes and any future one. A regex asserting
the guard *looks* right passed against fix 1.

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

### 2.10 `work_date` is stamped in the employee's timezone, and three callers compare it against UTC today

Found on 2026-10-17 by running `qa-run-workflows.mjs` in full for the first time
in days. It reported `attendance` FAIL — *"Clock In creates today's record — no row
appeared"* — while the product was working perfectly.

`clock_event` stamps `attendance_records.work_date` as
`(now() at time zone <employee default_timezone>)::date`, defaulting to
`Asia/Manila`. Three places compare that column against a date computed as
`new Date().toISOString().slice(0, 10)`, which is **UTC by definition**:

| Caller | What it drives | Window affected |
|---|---|---|
| `qa-exercise-attendance-workflow.mjs:65` | The Clock In/Out assertions | **Fixed** — see below |
| `lib/app/admin-pages.tsx:36` | `presentToday` on the admin dashboard | 00:00–08:00 Manila |
| `lib/app/admin-pages.tsx:229`, `:595` | leave and attendance window queries | 00:00–08:00 Manila |
| `lib/jobs/cron-jobs.ts:33` | the `missing_clock_out` cron | 00:00–08:00 Manila |

For eight hours a day those are different days. A manager opening the dashboard at
03:00 Manila is shown **yesterday's** present-count; the missing-clock-out cron looks
for the wrong day's open records.

**The exercise is fixed.** `workDateFor()` now lives in
`lib/attendance/zoned-time.ts` and states the database's own rule, and the exercise
prints both dates on every run so the discrepancy can never hide again:
`today in Asia/Manila: 2026-10-17 (host UTC date would be 2026-10-16)`. The exercise
went from **15/18 to 31/31**, and the leak it caused is gone — it had been leaving a
real attendance row on the Manila date while cleaning up the UTC one, which is also
why the rollup run's "no attendance records leaked — 201 -> 202" assertion failed.
That row has been removed; the demo employee's last real record is 2026-10-08.

**The three product callers are NOT fixed, and that is a decision rather than an
oversight.** They all need an answer to "what is today *for this organisation*",
which is not derivable from the code:

- The demo org is Manila-only, so `DEFAULT_TIMEZONE` would be right — and that is
  the same constant `clock_event` already falls back to.
- But `employees.default_timezone` exists and is per-employee. A single global
  "today" cannot be correct for a workforce spanning zones, and picking one zone
  would silently reintroduce the same off-by-one for everyone else.
- The org-level answer also belongs in the `organizations` table so it can be
  configured rather than compiled in.

So this is filed the way §2.1 is: **the code change is obvious, the product decision
is not mine to make.** The smallest correct fix, once a decision exists, is to pass
the org zone into `workDateFor` at all three call sites. Left as P2 pending that call.

The wider lesson is recorded on the helper: `new Date().toISOString()` is UTC, and
comparing it against a value a database computed in a local zone is a defect
waiting for the wrong eight hours of the day. The same idiom appears in ~15 other
places (invoice dates, incident dates, hire dates) where the consequence is a
business date that can be a day out rather than a wrong record; those were checked
individually and left alone.

### 2.11 Twenty exercises still depend on the orchestrator to write their evidence

`qa-exercise-admin-workflow.mjs` and `qa-exercise-attendance-workflow.mjs` now write
`docs/evidence/workflow-*.json` themselves. The other twenty do not: their evidence is
written by `qa-run-workflows.mjs`, and only by it.

That matters here because the orchestrator is the component that dies. 21 exercises
of browser load take `next start` to its ~2.4 GB ceiling; on 2026-10-17 a full run was
terminated before finishing its first exercise, leaving the app server dead as well.
When that happens the exercises that already ran keep whatever they wrote, and the
rest keep whatever the last completed run wrote — which can be a red record for a
defect that was fixed afterwards. That is exactly what happened to attendance: it
passed 31/31 on its own while its evidence file still read `FAIL`.

**THE THREE THAT WROTE IT THEMSELVES WROTE A VERDICT NOBODY COULD COUNT — fixed
2026-10-19.** Porting the pattern is what exposed this. All three self-writers
spelled their own verdict, and two of them spelled it **lowercase**:

```js
verdict: failed.length ? "fail" : "pass",     // uncovered-roles, attendance
verdict: failed.length ? "FAIL" : blocked.length ? "BLOCKED" : "PASS",   // admin
```

The rollup tallies **uppercase** — `tally("PASS")`, `tally("FAIL")`,
`tally("BLOCKED")`, `tally("SKIPPED")`, FLAKY — and `rollupFailed` filters on
`"FAIL"`. A lowercase verdict therefore matched **no bucket at all**, and was not
counted as a failure either. Measured on the evidence directory before the fix:

```
workflow-uncovered-roles.json   verdict="pass"  19 assertions
workflow-attendance.json        verdict="fail"/"pass"
workflow-admin-workflow.json    verdict="BLOCKED" (correct)
```

So a standalone run of `uncovered-roles` put its 19 assertions into
`totalAssertions` while making the exercise **invisible in the tally** — and §2.12c
tells you to run an exercise alone when the suite is untrustworthy, so the defect
was guaranteed to surface exactly when it mattered. It was hidden in a full suite
run only because the orchestrator overwrites every file it touches with its own
uppercase verdict afterwards. Two silent-zero paths in the same audit chain: an
exercise disappears from the rollup, and the assertion index drops it to zero.

**A second silent path, in the consumer.** `qa-workflow-assertion-index.mjs` read
`Array.isArray(doc.checks) ? doc.checks : []`, and the three self-writers put their
assertions under `results`. So after any standalone run, the index read that
exercise as **zero assertions, with no warning** — shrinking the behaviour universe
that `qa-control-surface-census.mjs` measures its 92.7% control-overlap against. The
committed index was generated 2026-10-16, before those writers existed in that
shape, and shows no exercise at zero, so nothing published was wrong. The path was
live, though, and a fallback that cannot tell "asserted nothing" from "shaped wrong"
reports the second as the first. That read now aborts the run instead.

**The fix is one shared writer, not three corrections.** `scripts/audit/lib/evidence.mjs`
derives the verdict from the exit code and the checks, and **no caller may pass one**
— so the lowercase form is unrepresentable rather than discouraged, which is the only
durable answer to a convention held by twenty files. It also removes a third copy of
the rule. One real ordering bug fell out of the conversion:
`qa-exercise-admin-workflow.mjs` wrote its evidence **before** setting
`process.exitCode`, so the file recorded `0` whatever happened; the write now sits
after the exit code is decided, which is also what makes deriving the verdict
correct rather than approximate.

Verified by running each converted exercise standalone, the path that used to hide
this: `uncovered-roles` **19/19**, `attendance` **31/31**, `admin-workflow` **23/23
exit 2 (1 BLOCKED — the invite leg, email quota)**. All three now write
`verdict` uppercase, `writer: "exercise"`, and their assertions under `checks`.
`tests/workflow-evidence-integrity.test.ts` (35 tests) holds the line: it fails on
any evidence file whose verdict the rollup cannot count, on any exercise that
hand-rolls its writer, and on a scan that finds no writers at all.

**Two writers, one file — so the orchestrator now merges instead of clobbering.**
Before this, an exercise that wrote its own evidence had it overwritten by the
runner seconds later, which is precisely why the casing bug was invisible in a
suite run. `mergeSuiteVerdict()` takes the exercise's record and sets the
**suite's** verdict on top, preserving the exercise's own outcome under `self`
and the runner's stdout parse under `suite`.

That merge is refused — and the runner falls back to writing from parsed stdout,
now recording *why* in `writtenFromStdoutBecause` — unless the file on disk was
written by **this** run (`writer: "exercise"`, `when` not older than the spawn).
The freshness check is the load-bearing part: an exercise that crashed before
reaching its write still has the previous run's file on disk, and merging this
run's verdict into it would produce a record that looks current, is internally
consistent, and describes a run that never finished.

Verified by `--only=uncovered-roles,attendance,payroll`, chosen to hit both
branches in one run:

| Exercise | Path taken | Result |
|---|---|---|
| `attendance` | merge | PASS, `self` 31/31, `suite` parsed 31, printedFailures 0 |
| `uncovered-roles` | merge | PASS, `self` 19/19, `suite` parsed 19, printedFailures 0 |
| `payroll` | stdout fallback, `"writer is null, not \"exercise\""` | FLAKY |

The two merged rows are also a cross-check worth having: the exercise's
in-memory assertion count and the runner's stdout parse **agree exactly** (31/31,
19/19). When they disagree, one of them is wrong and the file now shows both.

**`payroll` was FLAKY in that run and 19/19 alone** — §2.12c's load face, not a
regression from this change. Recorded because it is the second time a suite-context
failure has cleared on its own, and because the honest reading of the rollup is
that `documents` reading FAIL in the same output is **stale evidence from
2026-10-17**, not a fresh result: a partial run refreshes only the exercises it
ran, which is the whole reason the other seventeen want to write their own.

**The batch is done: all twenty-one exercises now write their own evidence.**
Verified on the three that exercise the awkward cases, run through the runner so
the merge path was used as well:

| Exercise | Verdict | `writer` | own count vs runner's parse |
|---|---|---|---|
| `hire` | PASS 23 | `exercise` | 23 / 23 |
| `client-timesheet` | PASS 14 | `exercise` | 14 / 14 |
| `payroll` | PASS 19 | `exercise` | 19 / 19 |

`tests/workflow-evidence-ownership.test.ts` holds the line that syntax and `tsc`
cannot: in every exercise, `writeEvidence(` must appear **after** the last
`process.exitCode` assignment. A write above it records `0` and calls a crashed
run a PASS, which is the defect `qa-exercise-admin-workflow.mjs` already had once.
The guard also fails on an empty scan, so a rule that stops finding anything
reports itself rather than passing quietly.

**Two things the conversion exposed, both now fixed.**

`hire` was converted into something that only worked when it failed. Its exit
code is not final inside `main()`'s `finally` -- that sets `1` only for a failed
assertion, and a throw that bypasses it still leaves the code unset -- so the
write could not go there, and putting it in the `.catch()` meant a **passing**
run wrote nothing at all, which is the exact dependency the batch exists to
remove. It now hangs off both terminal paths (`.then` for a resolved `main`,
`.catch` for a rejected one) behind a write-once latch. Because a `catch` handler
runs before the enclosing `finally`, the code is final by the time the write
happens on that path. Confirmed: a passing `hire` run now writes `23/23`.

`client-timesheet` carried a **NUL byte** inside a string literal, on the exact
line that scopes a guard to one employee's table row:

```js
hrPage.locator("tr").filter({ hasText: displayName ?? "\0" }).first()
```

When `displayName` is missing the locator filters on a NUL character, which
appears in no rendered page, so it matches **zero rows**: `count()` returned `0`,
`stillOffered` became `false`, and the check **passed having never looked at the
page**. A guard that cannot fail is not a guard. The absence is now recorded
through this file's own `blocked()` rather than absorbed.

That byte had a second effect nobody asked for: it made the file **binary as far
as `grep` is concerned**, so any repo-wide text scan skipped it without saying
so -- a grep-based guard finds twenty writers where `readFileSync` finds
twenty-one. The difference between a scan and a checker can itself be the blind
spot.

**The verification sweep is complete, and it is what settles §2.12's P2.** The
remaining fifteen were run in four chunks, **restarting the app server between
chunks by listening port**:

| Chunk | Exercises | Outcome |
|---|---|---|
| 1 | `auth`, `leave`, `notifications`, `documents` | 3 PASS; `auth` FLAKY on its signup leg |
| 2 | `nte`, `money`, `recruitment`, `crm` | 4 PASS |
| 3 | `cms`, `profile`, `list-filters`, `sitemap` | 4 PASS |
| 4 | `signup`, `tickets`, `ticket-detail` | 2 PASS; `signup` BLOCKED (email quota) |

Result: **21 files, all `writer: "exercise"`, all carrying a verdict the rollup
counts, none stale -- 18 PASS, 2 BLOCKED, 1 FLAKY, 0 FAIL, 495 assertions.**

Two things that sweep settled, both of which had been standing open:

- **`documents` passed 31/31**, retiring a `FAIL` that had been sitting in its
  evidence file since 2026-10-17. That is precisely the failure §2.11 was filed
  about, and the self-writing is what let a passing run correct it.
- **`crm` passed 21/21** on a fresh server after carrying FLAKY across two
  earlier runs. §2.12c's load face, reproduced -- and the restart is what
  cleared it.

The one remaining FLAKY is `auth`, whose failing leg is the signup path the
provider's email quota refuses; the two BLOCKED are `signup` (same cause) and
`admin-workflow` (its invite leg, same cause). **Every remaining non-PASS is the
email quota, not a product defect.**

**P3, deliberately not done now.** Porting the pattern is mechanical (copy the
`finally`-shaped writer, assert on the failure and throw paths), and doing it one
file at a time has already produced one real fix. It is not urgent while every
exercise passes, because the orchestrator still refreshes the file on any run that
completes. Doing all twenty at once would be a large diff for a condition that only
bites when a run is killed — so it is filed here to be done as a batch when the
server-death ceiling is addressed, not as twenty separate drive-by edits.

The related root cause is the memory ceiling itself, which is environmental rather
than a code defect: the slow tier exists for exactly this reason and the role sweep
(479 visits, 13 roles) runs clean on its own. What is missing is a way to run the 21
exercises without them accumulating in one process.

### 2.12 A failure inside the workflow suite is not evidence of a product defect

Three full runs on 2026-10-17 produced **six failures across five exercises**, then
**six failures across five different exercises**, then two more. A fourth run then
took the four unconfirmed exercises and ran each **alone**, 25 seconds apart:

| Run | Reported | Outcome when the exercise ran alone |
|---|---|---|
| 1 | `attendance` (6), `cms` (2) | `attendance` was a **real audit bug** (UTC vs employee timezone, fixed); `cms` 43/43 |
| 2 | `auth`, `notifications`, `tickets` (2), `documents`, `hire` | `hire` 23/23, `auth` 35/35, `tickets` 43/43 clean, SLA targets persisted, audit row written |
| 3 | `documents` (2), `uncovered-roles`, `crm` → **FLAKY** | `documents` exit 0, Download and MIME assertions green |
| 4 | `hire`, `notifications`, `auth`, `uncovered-roles`, each alone | `hire` 23/23 and `auth` 35/35 clean; **`notifications` failed**; `uncovered-roles` failed **on a different account each run** |

Run 4 is the useful one, because it produced two failures with **two entirely
different causes** — and neither was the one the table above had been assuming.

### 2.12a The one that really was the degraded server (`notifications`)

`notifications` failed alone, and it was honest: four assertions, all of them
about writes.

```
FAIL  markNotificationRead sets read_at  [null]
FAIL  markAllRead marks every notification that existed at the click read  [24 still unread of 24]
FAIL  the page shows no unread rows afterwards  [24 label(s) rendered, 0 arrived mid-run]
FAIL  toggling back writes the original value  [expected true, stored false]
```

Reads were landing and writes were not — the degraded face described below, on a
server that had been carrying the day's runs. The proof that it was not the
product is in `docs/evidence/workflow-notifications.json`: **the same four
assertions had passed 50 minutes earlier on the same 24 notifications**, with
`read_at` → `2026-10-17T02:52:50.039+00:00` and `0 still unread of 24`. Same
code, same database, same binary.

Restarting the server **by listening port** (never by a recorded PID — that kills
the npx wrapper and leaves `next-server` holding the port) and re-running it
alone gave **16/16, exit 0**, with every value identical to the passing run. The
curative step for this face is a restart; nothing about the notification code
needed changing.

### 2.12b The one that was never load at all (`uncovered-roles`)

`uncovered-roles` failed on `finance`, then on `client_admin` and `client_viewer`
together, then on `client_viewer` alone, then on all four. **A failing set that
changes identity between runs is a question, not an answer**, and this one
survived every re-run only because the re-runs were the *same* conditions.

Two candidate explanations were available and both were wrong:

1. *Provider throttling.* To test it rather than argue it,
   **`scripts/audit/test-auth-direct.mjs`** now performs the same password grant
   the login form performs, against Supabase's REST endpoint, with no browser and
   no Next.js in the path. It returned **HTTP 200 for all six demo accounts.**
   Not the provider.
2. *The degraded server.* The process was at **142 MB working set / 160 MB
   private** after 23 minutes of uptime, with `audit-server-fresh` reporting
   `fresh`. Nothing like the ~2.4 GB ceiling, and not one byte written.

The cause was the **instrument**. `signInAs` slept a fixed 2500ms and then read
`page.url()`. A duration is not an outcome: it is long enough on a fast machine
and short enough on a slow one, so what it measured was the machine's mood. It
also asserted something the product never promises — both login actions end in
`redirect(safeNext(next) || "/app")` (`lib/auth/actions.ts:92`), so `/app` is the
default for **every** role, and `landingPathFor` (`lib/auth/landing.ts:29`) then
sends a client to `/app/client` on a **second hop**. The check sampled the
journey between those two hops and called the sample a result.

Three defects in that one function, all now fixed and guarded:

| Defect | Symptom | Fix |
|---|---|---|
| Fixed sleep after submit | four different accounts "broken" across four runs | `waitForFunction` on the outcome — a session, or a `role="alert"` saying why not |
| `page.url()` read 2500ms after the click | client reported on `/app` while genuinely on `/app/client` | assert the **session** (form no longer present), not the destination |
| `sampleAt` captured the URL before its 900ms settle | `/app`'s server redirect not reflected in the sample | read the URL **beside the DOM**, after `settleUrl` |

A fourth, found by the new assertion rather than by a failure: `sales sees a
populated lead list` was passing **vacuously**. An unauthenticated visit to
`/app/crm/leads` lands on the public marketing page, which contains none of the
negative phrases the check looked for — so it reported PASS in the same run where
every sign-in had failed. It now asserts the URL first.

**Result: 19/19, exit 0, on two consecutive independent runs** (up from 17
assertions — the two added ones cover the second hop that used to be assumed).
Determinism is deliberate: the sign-in assertion is about the session, so
`client_viewer` may still be reported as settling on `/app` mid-hop and correctly
passes, and the second-hop check is what pins where it actually ends up.

`tests/audit-sign-in-instrument.test.ts` (9 tests) guards all of it on
comments-stripped source, mutation-proven: re-introducing the 2500ms sleep turns
exactly one assertion red.

### 2.12c Load, and why it must not be assumed either

The two faces above are real, and both were live during this session — §2.12a is
the degraded one. But §2.12b is the reason they cannot be assumed: a failure that
looks exactly like load was caused by neither.

`next start` reaches its ~2.4 GB ceiling under 21 exercises' worth of browser
driving; it sometimes dies outright, which §2.11's `serverAlive()` guard already
catches. More often it **degrades**: every request still answers, so the guard
sees nothing wrong, while writes stop landing. That is why an SLA edit reported
success and persisted nothing, and why a `Download` control went missing on a page
that renders it perfectly on its own.

The other face is **sign-in throttling**. Most of the failures across runs 1 and 2
were sign-ins landing back on `/login` — `hire` as HR, `uncovered-roles` as
client_viewer, `crm` as owner, `auth` at signup. Twenty-one exercises each signing
in several demo accounts can exhaust the Supabase password-grant budget, and that
looks identical to a broken login. **It is now testable rather than assumed:**
`scripts/audit/test-auth-direct.mjs` performs the same grant outside the browser,
and returns `THROTTLED` / `REJECTED` / `OK` / `UNKNOWN` (exit 3 unless `OK`). Run
it before believing any sign-in failure.

**The order that actually settles a failure**, learned the hard way on
2026-10-17 and worth more than any of the tooling above:

1. **Was the server degrading?** `audit-server-fresh.mjs` plus a working-set read.
   If it is, restart **by listening port** and re-run. This alone cleared
   `notifications`.
2. **Was it the provider?** `test-auth-direct.mjs`. This cleared
   `uncovered-roles`.
3. **Only then is it the product.** If 1 and 2 are both clean and the failure
   persists, it is real — and it is worth noting that steps 1 and 2 between them
   cleared three of the four run-4 failures without a single line of product code
   changing.

### 2.12d The same instrument defect is in every exercise, not one

§2.12b was fixed in `qa-exercise-uncovered-roles.mjs`, but the cause was never
specific to it. Roughly **twenty** audit scripts sign in by filling a login form
and clicking submit, and they all share two defects:

| Defect | Status |
|---|---|
| **The fill is not verified.** React hydrates after the server-rendered HTML is already interactive, and hydration **resets** what `fill` wrote. A submit in that window sends an empty form, `loginSchema` rejects it, `signInWithPassword` is never called, and the exercise reports a false failure. | Fixed repo-wide via `scripts/audit/lib/browser-form.mjs` → `fillHeld`, which settles, reads the field back, and refuses to submit a form that is not holding its values. `tests/audit-form-fill-integrity.test.ts` prevents the pattern returning. |
| **The outcome is decided by a duration.** `click` followed by a fixed `waitForTimeout(3000)` with no condition wait, then a verdict read from `page.url()`. A duration is not an outcome — it is long enough on a fast machine and short enough on a slow one. | **Fixed** at all eight verdict-flipping sites via `submitAndWaitOutcome` — `admin-workflow`, `crm-workflow`, `hire-workflow` (×2), `auth-workflow`'s `signIn`, `leave-workflow`, `payroll-workflow`, `qa-probe-session-identity`. The last two were found by the new guard, not by hand. |

The second row was left undone in the sweep commit on purpose: it touches every
exercise, and bundling it with a change that is otherwise about attribution makes
it impossible to tell which edit fixed what. It was done as its own change
afterwards, and the guard earned its keep immediately — it named
`payroll-workflow:165` and `qa-probe-session-identity:39`, two sites a search had
missed and a directory-scoped sweep had not reached.

`submitAndWaitOutcome()` waits for one of the two facts a submit can produce —
the session exists, or the app published why not — and returns which.

**The guard is scoped tightly, and deliberately.** `waitForTimeout` appears all
over these scripts: after a `goto`, before reading a table row, around a dialog
animation. Those waits precede an assertion about *content* that either exists
or does not, so they rarely flip a verdict; banning them would be ceremony
rather than evidence. The rule catches only the shape that does flip one —
submit, fixed sleep of 2s or more, then `page.url()` read as the verdict. A
submit that sleeps before reading page *text* is not covered, because its outcome
is the copy rather than the route, and the same race does not decide it.

One limit of the fill guard, recorded so it is not over-read: it matches a fill
whose target expression names `password`. A locator held in a variable whose
name does not — `pwInputs.nth(i).fill(...)` on the signup form in `auth-workflow`
— is not covered, and neither are non-credential forms.

**Consequence for reading this board: a red exercise here is a question, not an
answer.** The suite is not currently a trustworthy attribution mechanism for any
surface. It is still worth running — it found a real bug in run 1, it refreshed 489
assertions of coverage in about twenty minutes, and it is what surfaced
`uncovered-roles` — but a failure from it must be walked through the three steps
above before anyone believes it.

`qa-run-workflows.mjs` now earns a failure one confirmation re-run before it is
allowed to name a surface, and reports `FLAKY` when that re-run clears. `FLAKY` is
counted apart from both PASS and FAIL and exits 2, so a suite that only went green
on retry is never published as a clean one.

**Known limitation of that confirmation, recorded so it is not over-read:** the
re-run happens 15 seconds later, against a server still carrying the load. That is
a second sample from the same conditions, not isolation. Run 3 reported
`documents` and `uncovered-roles` as still failing on re-run, and both passed
outright ten minutes later on their own. The honest reading of "still failing on a
re-run 15s later" is *this one may be real — go and run it alone*, and the evidence
file now says exactly that rather than the firmer "reproduced".

Run 4 then showed that **"alone" is necessary but not sufficient**. Each of the
four exercises was run alone, 25 seconds apart, and two still failed — one because
the server was degraded, one because the exercise's own instrument was. Running
alone removes the accumulation; it does not tell you which of the three causes you
have. That is what steps 1–3 in §2.12c are for.

The structural fix is to stop accumulating: restart the app server between exercises
(or run them against a fresh one), which would remove both faces of this at once.
That is P2, and it is still a decision rather than a change — but it is no longer a
hypothesis.

**MEASURED 2026-10-19 — chunked execution with a restart between chunks clears
exactly the failures this section attributes to accumulation.** All twenty-one
exercises were run in four chunks against a server restarted by listening port
between each, and the result was **18 PASS, 2 BLOCKED, 1 FLAKY, 0 FAIL, 495
assertions**, with every non-PASS traced to the provider's email quota. Two
results that had been standing open moved:

- `crm` had carried **FLAKY across two earlier runs**; on a fresh server it
  passed 21/21.
- `documents` had been sitting at **FAIL in its evidence file since 2026-10-17**
  while the exercise itself passed; it passed 31/31.

So the load face is not a theory that survives contact with a measurement — it
is reproducible, and removing the accumulation removes the failures. What remains
undecided is only whether a test runner is *permitted* to manage the server it is
testing, which is a question about authority rather than about the cause.

### 2.13 Signup was blocked by the provider's mail budget, and one error shape is unexplained

**PARTLY RESOLVED 2026-10-18 — see the correction at the end. Read that first.**

**Blocked, environment.** Measured 2026-10-17 by calling `/auth/v1/signup` directly, with no
browser and no Next.js in the path:

```
signup HTTP 429
error_code   : over_email_send_rate_limit
description  : email rate limit exceeded
user created : false
```

Every signup is refused. This is the same ceiling that makes the forgot-password
leg of `qa-exercise-auth-workflow.mjs` report `BLOCKED`, and it is why that
exercise finished 34/35 rather than 35/35. No account can be created in this
environment right now, by the form or by any other route, so the signup leg
cannot be used to validate anything until the budget resets.

**The unexplained part, recorded rather than guessed at.** The browser run
showed **"Unable to create account with that email."** — `signupErrorMessage`'s
*rejected* branch, which it only reaches when `status` is neither `429`, nor `0`,
nor `>= 500`. But the SDK's own error object for exactly this condition carries
`status: 429` and `code: "over_email_send_rate_limit"` (measured through
`supabase.auth.signUp`, not raw fetch), and `authFailureKind` classifies `429` as
rate-limited. So **the mapper is correct for the shape I could reproduce**, and
the browser's error must have carried a different status that was not captured.

That is the whole of what was known. It is **not** evidence of a defect in
`authFailureKind`, and no change was made to `lib/auth/error-messages.ts` on the
strength of it — publishing a fix for a defect that has not been reproduced is
the same error as publishing a fix that does not exist. What it *is* is an
unexplained disagreement between two measurements of the same action, and the
honest next step is to capture `error.status`, `error.code` and `error.name` at
the point the action returns them, then re-run once the mail budget resets.

**One data point that narrows it, recorded 2026-10-17 afternoon.** A later run of
`qa-exercise-auth-workflow.mjs` — with no change to `authFailureKind` or to any
mapper — came back **35/35** with the signup leg reported `BLOCKED ... Supabase
429 email rate limit (environment)` rather than `FAIL`. So when a genuine 429
reaches the app, the app *does* render the rate-limited branch, and the exercise
*does* classify it as environmental instead of as a product failure. That is
evidence the mapper and the classification are both right for the shape I can
reproduce, and it makes the earlier rejected copy more puzzling rather than less:
something produced a non-429 status on that one occasion, and nothing recorded
what it was.

**CORRECTION, 2026-10-18 — the cause is found, and no mapper was ever wrong.**

With the budget exhausted, a fresh probe answered a different question: the
throwaway address was the problem all along. `qa.signup.<ts>@nowhere.example`
returns

```
HTTP 400  email_address_invalid
"Email address "qa.probe.1792332172934@nowhere.example" is invalid"
```

`.example` is a **reserved TLD**, and user-initiated `signUp` validates the
address. `authFailureKind(400)` returns `rejected`, so **"Unable to create
account with that email" was accurate** — the address really was invalid. The
mapper was right; the harness was submitting an address the provider refuses.
The same file's admin-API paths accept the domain, which is why `createUser` and
the cleanup calls worked on `@nowhere.example` while the signup leg could never
have passed. This is §2.14's shape one layer over: a fixture's own property
manufactured a finding that was then reported as a product defect.

`SIGNUP_EMAIL` now uses `@demo.beepabpo.com`, the domain
`qa-exercise-client-invite.mjs` already adopted for the identical reason
(`inviteUserByEmail` validates the domain too).

**What is still open, stated precisely.** That a reserved TLD is rejected is
established. Whether signup **succeeds** on an accepted domain is not: the
quota is exhausted again as of this writing (`429` for every domain, including
`@beepabpo.com`), so the leg cannot be exercised. Re-run `qa-exercise-auth-workflow.mjs`
once the budget resets; if the signup leg then passes, the item closes.

**SECOND CORRECTION, 2026-10-18 late — the domain swap is not a fix, and is
probably still wrong.** A probe run against the fixed fixture produced one
clean request *before* the limiter re-engaged, and it did not come back `429`:

```
email : qa.signup.1792336277713@demo.beepabpo.com
error : 400 Email address "qa.signup.1792336277713@demo.beepabpo.com" is invalid
```

`@demo.beepabpo.com` is refused by **user-initiated** `signUp` for the same
reason `@nowhere.example` was. This is the §2.14 shape again, and it is now
the third instance of it: the same file's admin-API paths accept the domain and
the user path does not, so "the domain this project uses everywhere" is not
evidence that any given domain is accepted. **Revise the expectation above** —
the fixture change in `237a53e` should not be expected to close this leg, and
the next attempt should be one signup on a genuinely deliverable address, not
another swap between domains this project already uses.

**Two things this section must not be read as claiming.** First, this is **one**
observation on one address and it is recorded as such; it is not a proven cause,
and it is the reason to re-test, not a reason to have already fixed something.
Second, the follow-up probe in the same run — four addresses, one per domain —
came back `429` for **all four**, including `gmail.com` and including
`@nowhere.example`, which was independently observed returning `400` hours
earlier. That is not a contradiction and it is not a domain result: while the
limiter is firing, `signUp` answers `429` *before* it reaches address
validation, so a rate-limited response says nothing at all about which domains
would be accepted. A domain sweep run during a quota outage cannot answer the
question, and the five requests it costs make the outage worse. That sweep was
the mistake here, and it is recorded so the next attempt does not repeat it: the
clean experiment is **exactly one** signup, on a deliverable domain, with the
budget confirmed available first.

**THIRD CORRECTION, 2026-10-19 — the domain question is answered, and then I
spent the evidence myself.**

One request on the **apex** domain, at a moment the window was open:

```
qa.signup.1792382903777@beepabpo.com    ->  no error, user created, deleted
```

So `@beepabpo.com` is **accepted** where `@demo.beepabpo.com` is refused `400`
by user-initiated `signUp`. A `400` means the request got *past* the limiter and
then failed validation, so this is a property of the address rather than of the
budget — and the third instance in this repo of one domain, two APIs, one valid
and one not. `inviteUserByEmail` (admin) accepts `demo.`; `signUp` (user) does
not. Copying the precedent from `qa-exercise-client-invite.mjs` was correct for
the admin API and wrong for the user path. The fixture now uses the apex.

**Then I ran the auth exercise, and its signup leg was BLOCKED on "Supabase 429"
— and that 429 was mine.** A second single probe, minutes later:

```
qa.probe.<ts>@beepabpo.com  ->  429 email rate limit exceeded
```

**The window holds roughly one signup.** My probe took it, and the exercise that
followed had nothing left. I announced "signup accepted, 2.13 closes" and then
reported a suite in which signup was blocked; both statements were true and the
second was caused by the first. This is the confound §2.12's "change one
variable" entry warns about, committed against myself: **a probe that consumes
the resource under test invalidates the next measurement, and the invalidation is
invisible because the next measurement's failure reads as a fresh fact.**

**Established, and not established.**

- *Established:* the apex is accepted, the `demo.` subdomain is refused by
  user-initiated `signUp`. The fixture change is correct on its own evidence.
- *Not established:* that the signup leg passes end to end. It has never run with
  a window available, and every attempt costs one signup, so **the window must be
  left for the exercise rather than spent on a probe.**

**How this closes.** Wait for the window, then run `qa-exercise-auth-workflow.mjs`
**alone, with no probe before it**. If the leg passes, §2.13 closes. Until then the
correct reading of BLOCKED is *"unverified for want of one email send"*, not
*"the fix did not work"*.

**Separately, an open question recorded rather than claimed.** Two runs of that
exercise on a freshly restarted server failed **different** assertions — first
`a client user can sign in at /login` and `an internal user gets through the
employee portal`, then `the NEW password works for sign-in` — while
`test-auth-direct.mjs` reported HTTP 200 for all six demo accounts, so the
provider is not the cause. A failing set that changes identity between runs is a
question, not an answer (§2.12b). It is **not** filed as a defect and is not
chased further while each retry costs email budget.

**RETRY 2026-10-19 13:20 — the moving failure set did not recur, and signup is
still 429.** Run alone on a freshly restarted server, with no probe in front of
it, exactly as recorded above: **35/35, exit 0**, including every password-change
and sign-out-everywhere leg that failed in one of the two earlier runs. So the
instability is not reproducing on demand, which is a data point and **not** a
resolution — an intermittent fault that has not appeared in one run is still
unexplained, and the password-grant hypothesis stands untested.

The two BLOCKED paths now carry their reasons into the evidence file, which is
what this batch fixed, and they are **different causes**:

| Path | Reason |
|---|---|
| `forgot-password anti-enumeration comparison` | the real address hit the delivery ceiling; a sibling assertion confirms the COPY is identical when a send is allowed through |
| `signup account creation` | `Supabase 429 email rate limit (environment)` |

The first is the documented, deliberately accepted cost of surfacing a failed
send as an error rather than masking it (`15a5193`), and the exercise classifies
it correctly. The second is the quota, unchanged.

**On the signup window specifically — a correction to how it was described.**
It was recorded as "roughly one signup" per window, and two attempts 45 minutes
apart both returned `429`. That is not an hourly window; it is a longer cap, and
scheduling an hourly retry is the wrong response to it. **No further probe will
be spent**: every probe costs the one attempt the exercise needs, which is
exactly the mistake this section records. The next attempt should be made when
the provider reports the quota reset, not on a timer.

**The leading hypothesis, labelled as one — password grants, not email.** The
obvious suspect was ruled out by reading rather than by re-running: `signIn()`
already uses `fillHeld` and `submitAndWaitOutcome`, the employee portal's button
really is `button[type="submit"]`, and `submitAndWaitOutcome` waits for either a
leave from `loginPath` or an `[role="alert"]` — so the instrument is not deciding
the verdict on a timer or on a selector that does not match.

What is left is the **order of operations inside one run**. `auth-workflow`
performs roughly eight to ten password grants in sequence — wrong-password, real
sign-in, "sign out everywhere", the second device, the client account, the
employee portal, then the password-change leg. `test-auth-direct.mjs` performs
**six** grants from a cold start and reports them all healthy. Those are not the
same question: a budget that satisfies six grants from cold can still be
exhausted part-way through a run, and the assertion that fails would then depend
on where in the sequence the ceiling is reached — which is exactly the observed
signature, different assertions on different runs, a clean provider probe, and a
server that a restart does not help.

**This is a hypothesis, not a finding, and it has now been TESTED AND REFUTED.**

The test cost no mail, which is why it was the right experiment: **password grants
send no email**, so the quota that gates signup and forgot-password is untouched.
Twenty consecutive grants against the REST endpoint, mirroring the accounts
`auth-workflow` actually uses and in the order it uses them:

```
grants 1..20   HTTP 200 for all twenty, across owner / marketing /
               clientadmin / hr @demo.beepabpo.com
```

The exercise performs roughly ten grants per run. **Twenty in a row, none
refused**, so there is no password-grant ceiling being reached mid-run, and the
hypothesis is wrong. The cheap explanation is now eliminated rather than merely
unproven — which is a better position than the one it replaces, because the next
person no longer has to test it.

**What remains open, stated honestly.** The moving failure set has some cause
that is neither the provider (200 for every account, from cold and now in a
20-long run), nor accumulated server load (both failures came on freshly
restarted servers), nor a grant ceiling (above). It has not reproduced in the
run since. Chasing it further would mean repeating a multi-minute browser run
that costs email budget, to chase a fault that appears in roughly 2 runs of 10.

**The honest position is that this is unresolved and is not being resolved by
guessing.** A failing set that changes identity between runs, with a clean
provider and a clean server, is exactly the situation §2.12b describes; the
answer to it is a reproduction with instrumentation, and the instrumentation
does not exist yet. Adding a probe that records *which grant preceded the first
failing assertion* is the smallest next step and is not implemented, because
building it means editing an exercise whose every run currently costs a signup.

### 2.14 The control census was naming controls after their data

§2.12 is about the workflow suite misattributing failures. This is the same
class one level over: an audit that produced a *number* was wrong, and the
number was reproducible, because it was measuring itself.

`qa-control-surface-census.mjs` walked 444 pages across 13 roles and reported
**85%** action-control coverage, with a "52 controls with no matching assertion"
gap. Both figures were wrong, and the gap list showed why once read as data
rather than as names:

```
"reason"  [field]      "semi_monthly"  [field]
"notes"   [field]      "25000"         [field]
"new"     [field]      "won"           [field]
```

`nameOf` read `aria-label`, `title`, `placeholder`, `name` — and then fell back
to **`el.value`** — while never once consulting `<label for>`, a wrapping
`<label>`, or `aria-labelledby`, which are the sources that actually name form
controls. Two failures came out of that:

1. A `<select>` labelled "Pay frequency" was recorded as `semi_monthly`, its
   *selected value*. `matchAssertion` then compared a data value against
   assertion names and could never match, so the gap it printed was
   substantially an artifact of its own extractor.
2. A control with no label at all was reported as **named**, because it had a
   value. So the run's `0 controls with no accessible name` was partly true only
   because a name had already been invented for them. **A form value is data the
   user chose; it is never an accessible name**, and falling back to it converts
   "I could not find a name" into "here is a name" — which makes the one finding
   the census exists to report impossible to make.

Fixing it exposed a second defect in the same function. Reading
`label.textContent` is wrong when the label *wraps* its control, because the
control's own text lives inside the label and a `<select>` contributes every
`<option>`:

```
"StatusAll statusespendingmanager approvedhr approved..."
```

That is the control's data spliced onto its label, and it filled the gap report
with rows that are not names at all. `labelTextFor` now clones the label and
removes the control it labels before reading.

**Corrected and complete: 92.7% over 444 pages, 13 roles, 0 pages failed, 0
controls with no accessible name, 23 in the gap.** The gap went 52 → 44 → 23 as
each layer of the extractor was corrected, and real labels replaced data values
(`Reason`, `Visibility`, `Slug`, `Excerpt`, `Week of`).

**Re-measured 2026-10-19, because its input moved: 92.8%.** §2.11's batch
regenerated `workflow-assertion-index.json` from freshly written evidence, and
`uncovered-roles` now contributes 19 assertions where the 92.7% above was
measured against 17. Re-run against a server restarted immediately beforehand:

| Measure | 2026-10-18 (runs B–E) | 2026-10-19 (run F) |
|---|---|---|
| Pages visited / failed | 443–444 / 0–1 | **444 / 0** |
| Cold-start retries | 0 | 0 |
| Action controls | 316 | 318 |
| Action controls matched | 293 | 295 |
| **Action overlap** | 92.7% | **92.8%** |
| **Gap (unmatched)** | **23** | **23** |
| Distinct / named / unnamed controls | 515 / 515 / 0 | 517 / 517 / 0 |
| **Navigation overlap** | 71.1% (32/45) | **66.7% (30/45)** |

The action figures held — one tenth of a point, and the gap is still exactly 23 —
which is the useful part: the headline coverage number survived a change to the
assertion set behind it. **The navigation overlap did not**, falling 71.1% → 66.7%
as two of forty-five nav controls stopped matching. That is the honest report and
it is not buried: it is the number that moved, it moved because the comparison
set changed rather than because the product regressed, and it is a proxy in both
directions in any case. Neither figure is a measurement of coverage; the caveat
below stands and governs both columns.

Guarded by `tests/census-accessible-name.test.ts` (6 tests), mutation-proven in
both directions, with the same comment-strip control the other extractor tests
use.

**One measurement was refused rather than published.** An intermediate run
reported **92.2%** and was *not* recorded. It had 24 page failures, all in
`owner` — the first role walked — and `owner` reached 35 of its ~58 pages while
carrying the most controls in the system. The percentage was computed over a
partial denominator. A later run on a fresh server gave 444 pages and 0
failures, and **that** is the run on record.

**The cold-start explanation was wrong, and the evidence that refutes it is in
this repository.** `gotoWarm()` was then added to retry a navigation once on
timeout, on the theory that lazy route chunks made the first hit slow. It is a
sound defensive measure and it is still there, but the next run on a cold server
recorded **`coldStartRetries: 0`** — the retry never fired, and that run still
differed. `coldStartRetries` is printed and stored rather than swallowed
precisely so a reader can see that a retry-free run and a retry-heavy run are
not comparable walks; it is an honest instrument, not a proven cure.

The browser is now also **relaunched per role** rather than once for all
thirteen, so each role's measurement depends only on its own pages rather than
inheriting everything loaded before it. That is the right shape for the
instrument. **It is not a cure either, and it is not claimed as one:** two
consecutive cold runs after the change still gave 1 failed page and 0 failed
pages.

What the whole series actually shows, on identical code with a freshly started
server each time:

| Run | Pages | Failed | Cold-start retries | Overlap | Unmatched |
|---|---|---|---|---|---|
| A | 420 | **24** | (no retry logic) | 92.2% | — |
| B | 444 | 0 | 0 | 92.7% | 23 |
| C | 443 | 1 | 0 | 92.7% | 23 |
| D | 443 | 1 | 0 | 92.7% | 23 |
| E | 444 | 0 | 0 | 92.7% | 23 |

Two things are true at once, and the second is the one that matters:

1. **Page-level failures still vary** — 24 once, then 0 to 1. Neither the
   per-navigation retry nor the per-role browser relaunch removed that, so the
   cause is still open and is still §2.12's: something about running a long walk
   in one environment.
2. **The published figures did not move.** Every run since the extractor fix
   reports **92.7%** overlap and **23** unmatched, including the run that lost 24
   pages. The 92.2% outlier moved because those 24 failures all landed in
   `owner`, the most control-rich role; losing one or two pages does not.

So the derived coverage number is far less fragile than the walk that produces
it, which is a better place to be than the reverse — but it is stable by luck of
where the failures fall, not because the walk is repeatable. **Quote these
numbers only from a run that reports its own `pagesFailed` and `coldStartRetries`
alongside them**, and treat two runs as comparable only when both do.

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
pnpm qa:auth-probe         # direct Supabase password grant: THROTTLED / REJECTED / OK
node scripts/audit/audit-server-fresh.mjs   # is the running server the build on disk?
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