/**
 * Retire a stub payroll period so `payroll_periods` stops overlapping — READ-ONLY unless `--apply`.
 *
 * Ship gate step 10 ("Payroll periods do not overlap") fails because two periods
 * cover the same days:
 *
 *   [4fb757e0] September 1–15, 2026   2026-09-01 .. 2026-09-15  finalized
 *   [929abbb1] September 2026 payroll 2026-09-01 .. 2026-09-30  draft
 *
 * The organization pays `semi_monthly`, so September is legitimately two
 * fortnights. `4fb757e0` is a real computed run. `929abbb1` is not a payroll
 * result at all: every one of its records carries
 * `calculation_snapshot = {"engine":"stub_v1"}`, zero statutory deductions, and an
 * identical `worked_minutes` of 4800 across a 30-day window. It is seed data that
 * a month-wide period was built around.
 *
 * Leaving it in place is not merely untidy. The overlap means the same worked days
 * are pulled into two runs, so migration `20261007120000_payroll_period_no_overlap.sql`
 * cannot be applied: `ALTER TABLE ... ADD CONSTRAINT` validates the whole table and
 * fails on existing rows. The schema cannot protect payroll from double payment
 * until the conflict is gone.
 *
 * This script retires only the stub side, and only when it can prove that side
 * carries nothing real. It never touches approved or disbursed payroll.
 *
 * Safety:
 *   - Dry-run by default; `--apply` is required to write.
 *   - Refuses if the target period is in an approved terminal state.
 *   - Refuses if ANY record in the target period is not `engine: stub_v1`, so a
 *     real computed run can never be deleted by pointing this at the wrong period.
 *   - Enumerates the full delete cascade BEFORE writing, and refuses if any row
 *     would be silently orphaned (`ON DELETE SET NULL` on cash advances or
 *     commissions) unless `--allow-orphan-links` is passed, because losing that
 *     link loses the audit trail from a deduction to the payslip that carried it.
 *   - Deletes with a single statement on the period, so Postgres applies the whole
 *     cascade atomically; there is no half-deleted state to clean up.
 *   - Re-runs the overlap test afterwards and exits non-zero if any overlap remains.
 *
 * Run: node scripts/reconcile-payroll-period-overlap.mjs
 *      node scripts/reconcile-payroll-period-overlap.mjs --apply
 *      node scripts/reconcile-payroll-period-overlap.mjs --period <uuid> --apply
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

/**
 * Stop with `code` WITHOUT calling `process.exit()`.
 *
 * Calling `process.exit()` while undici's keep-alive socket to Supabase is still
 * closing trips a libuv assertion on Windows and turns a clean refusal into crash
 * code 0xC0000409 (STATUS_STACK_BUFFER_OVERRUN), which masks the exit status this
 * script promises. Verified against this repo's client: `process.exit(2)` after a
 * query yields 0xC0000409; setting `process.exitCode` yields 2. So every exit goes
 * through `stop()`, which unwinds the module and lets the event loop drain.
 */
class StopSignal extends Error {}

process.on("uncaughtException", (err) => {
  // A StopSignal already set exitCode; let the loop drain and keep it.
  if (err instanceof StopSignal) return;
  console.error(err);
  process.exitCode = 1;
});

function stop(code) {
  process.exitCode = code;
  throw new StopSignal();
}

function env() {
  const out = {};
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[t.slice(0, i).trim()] = v;
    }
  }
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (process.env[k]) out[k] = process.env[k];
  }
  const key = out.SUPABASE_SECRET_KEY ?? out.SUPABASE_SERVICE_ROLE_KEY;
  if (!out.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL not found");
  if (!key) throw new Error("This script needs a privileged key (SUPABASE_SECRET_KEY)");
  return { url: out.NEXT_PUBLIC_SUPABASE_URL, key };
}

const argv = process.argv.slice(2);
const dryRun = !process.argv.includes("--apply");
const allowOrphanLinks = argv.includes("--allow-orphan-links");
const periodArgIndex = argv.indexOf("--period");
const forcedPeriodId = periodArgIndex >= 0 ? argv[periodArgIndex + 1] : null;

const { url, key } = env();
const sb = createClient(url, key, { auth: { persistSession: false } });
console.log(`mode: ${dryRun ? "dry-run (no writes)" : "APPLY"}`);

/** Period states that mean payroll was approved and is owed to an employee. */
const APPROVED = ["finalized", "disbursed", "closed"];

// `pay_frequency` only exists once 20260922120000_payroll_frequency_fixed_salary.sql
// is applied, and this script is meant to run *before* that. Read the columns that
// are present in every schema revision.
const { data: periods, error: pErr } = await sb
  .from("payroll_periods")
  .select("id, name, organization_id, start_date, end_date, status")
  .limit(2000);
if (pErr) throw pErr;

const all = periods ?? [];
if (all.length === 0) {
  console.log("no payroll periods; nothing to reconcile.");
  stop(0);
}

for (const p of all) {
  console.log(`  [${p.status}] ${p.name}  ${p.start_date}..${p.end_date}`);
}

/** Inclusive-inclusive, matching daterange(start_date, end_date, '[]'). */
const overlaps = (a, b) => a.start_date <= b.end_date && b.start_date <= a.end_date;

const byOrg = new Map();
for (const p of all) {
  const list = byOrg.get(p.organization_id) ?? [];
  list.push(p);
  byOrg.set(p.organization_id, list);
}

/** Every unordered pair of overlapping periods in one organization. */
const conflictPairs = [];
for (const [, list] of byOrg) {
  const sorted = [...list].sort((a, b) => a.start_date.localeCompare(b.start_date));
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (sorted[j].start_date > sorted[i].end_date) break;
      if (overlaps(sorted[i], sorted[j])) conflictPairs.push([sorted[i], sorted[j]]);
    }
  }
}

if (conflictPairs.length === 0) {
  console.log("\nno overlapping periods; nothing to reconcile.");
  stop(0);
}

console.log(`\noverlapping pairs: ${conflictPairs.length}`);

if (forcedPeriodId) {
  const inConflict = conflictPairs.some(([a, b]) => a.id === forcedPeriodId || b.id === forcedPeriodId);
  if (!inConflict) {
    console.error(`--period ${forcedPeriodId} is not part of any overlapping pair.`);
    stop(2);
  }
  console.log(`target period (explicit): ${forcedPeriodId}`);
}

/**
 * Pick the member of each overlap to retire: the one that is not approved and
 * whose records are all stub data. When that is ambiguous, stop and make the
 * caller choose rather than guessing at payroll.
 */
const targets = [];
for (const [a, b] of conflictPairs) {
  const candidates = [a, b].filter((p) => !APPROVED.includes(p.status));
  if (candidates.length === 0) {
    console.error(
      `  BOTH sides of the ${a.name} / ${b.name} overlap are approved. ` +
        "This is a real double-payment and needs a human decision, not an automated fix.",
    );
    stop(2);
  }
  if (candidates.length > 1 && !forcedPeriodId) {
    console.error(
      `  ${a.name} / ${b.name}: both sides are unapproved, so this script cannot tell ` +
        "which one to retire. Re-run with --period <uuid>.",
    );
    stop(2);
  }
  const chosen = forcedPeriodId
    ? ([a, b].find((p) => p.id === forcedPeriodId) ?? candidates[0])
    : candidates[0];
  if (!targets.some((t) => t.id === chosen.id)) targets.push(chosen);
}

const targetIds = targets.map((t) => t.id);
console.log(`\nretiring ${targetIds.length} period(s): ${targets.map((t) => `${t.name} [${t.status}]`).join(", ")}`);

for (const t of targets) {
  if (APPROVED.includes(t.status)) {
    console.error(`  refusing: ${t.name} is '${t.status}', which is approved payroll.`);
    stop(2);
  }
}

const { data: records, error: rErr } = await sb
  .from("payroll_records")
  .select("id, employee_id, payroll_period_id, status, worked_minutes, net_pay, calculation_snapshot")
  .in("payroll_period_id", targetIds)
  .limit(5000);
if (rErr) throw rErr;

const recs = records ?? [];
const engineOf = (r) => (r.calculation_snapshot ?? {})?.engine ?? null;
const notStub = recs.filter((r) => engineOf(r) !== "stub_v1");

console.log(`\nrecords in scope: ${recs.length}`);
for (const r of recs) {
  console.log(
    `  ${r.id}  employee=${r.employee_id}  status=${r.status}  worked_minutes=${r.worked_minutes}  ` +
      `net=${r.net_pay}  engine=${engineOf(r)}`,
  );
}

if (notStub.length > 0) {
  console.error("");
  console.error(
    `refusing: ${notStub.length} record(s) in the target period are NOT stub_v1, so they are real`,
  );
  console.error("computed payroll. This script will not delete them. Resolve those by hand:");
  for (const r of notStub) console.error(`  ${r.id}  engine=${engineOf(r)}  status=${r.status}`);
  stop(2);
}

if (recs.length === 0) {
  console.log("\ntarget period(s) hold no records; safe to retire directly.");
}

const recordIds = recs.map((r) => r.id);

/**
 * Count rows in a table that reference the retiring records.
 *
 * Tolerates a table or column that does not exist yet: the FK columns here come
 * from migrations that may not be applied in every environment, and "the table is
 * absent" and "the table is empty" both mean this cascade leg has nothing at risk.
 */
async function countLinked(table) {
  const ids = recordIds.length ? recordIds : ["00000000-0000-0000-0000-000000000000"];
  const { data, error } = await sb.from(table).select("id").in("payroll_record_id", ids).limit(5000);
  if (error) {
    const code = error.code ?? "";
    if (code === "42P01" || code === "42703" || code === "PGRST200") {
      console.log(`  (note: ${table} not readable in this schema revision, treating as 0)`);
      return [];
    }
    throw error;
  }
  return data ?? [];
}

const components = await countLinked("payroll_components");
const payslips = await countLinked("payslips");
const cashAdvances = await countLinked("cash_advance_deductions");
const commissions = await countLinked("commission_records");

console.log("\nDELETE CASCADE (postgresql will apply this):");
console.log(`  payroll_periods      ${targetIds.length}`);
console.log(`  payroll_records      ${recs.length}`);
console.log(`  payroll_components   ${components.length}   (on delete cascade)`);
console.log(`  payslips             ${payslips.length}   (on delete cascade)`);
console.log(`  cash_advance_deductions ${cashAdvances.length}   (on delete SET NULL — row survives, link does not)`);
console.log(`  commission_records   ${commissions.length}   (on delete SET NULL — row survives, link does not)`);

const orphans = cashAdvances.length + commissions.length;
if (orphans > 0 && !allowOrphanLinks) {
  console.error("");
  console.error(
    `refusing: ${orphans} row(s) point at these records through ON DELETE SET NULL. The rows survive but`,
  );
  console.error("the link to the payslip that carried them is lost. Re-run with --allow-orphan-links");
  console.error("if that is genuinely acceptable for these rows.");
  stop(2);
}

if (dryRun) {
  console.log("\nre-run with --apply to retire these periods.");
  stop(0);
}

// One statement on the period: Postgres applies the whole cascade atomically, so
// there is no state in which the records are gone but the period still overlaps.
const { error: delErr } = await sb.from("payroll_periods").delete().in("id", targetIds);
if (delErr) throw delErr;

const { data: afterRecords } = await sb.from("payroll_records").select("id").in("id", recordIds);
const { data: afterPeriods } = await sb
  .from("payroll_periods")
  .select("id, name, start_date, end_date, status, organization_id")
  .limit(2000);

const leftover = afterRecords ?? [];
const remaining = afterPeriods ?? [];
const stillOverlapping = [];
const grouped = new Map();
for (const p of remaining) {
  const list = grouped.get(p.organization_id) ?? [];
  list.push(p);
  grouped.set(p.organization_id, list);
}
for (const [, list] of grouped) {
  const sorted = [...list].sort((a, b) => a.start_date.localeCompare(b.start_date));
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (sorted[j].start_date > sorted[i].end_date) break;
      if (overlaps(sorted[i], sorted[j])) stillOverlapping.push([sorted[i], sorted[j]]);
    }
  }
}

console.log(`\nretired ${targetIds.length} period(s); ${leftover.length} record(s) unexpectedly remain.`);
if (leftover.length) for (const r of leftover) console.log(`  STILL PRESENT: ${r.id}`);

if (leftover.length > 0 || stillOverlapping.length > 0) {
  for (const [a, b] of stillOverlapping) {
    console.log(`  STILL OVERLAPPING: ${a.name} (${a.start_date}..${a.end_date}) vs ${b.name} (${b.start_date}..${b.end_date})`);
  }
  console.log("\ngate step 10 will still fail. Resolve the remainder by hand.");
  stop(2);
}

console.log("no overlapping periods remain; migration 20261007120000_payroll_period_no_overlap.sql is now safe to apply.");