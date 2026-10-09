/**
 * Create the remaining semi-monthly payroll window for September 2026 — READ-ONLY unless `--apply`.
 *
 * Retiring the `stub_v1` seed period removed 10 payroll records that were pure
 * fiction: `worked_minutes: 4800` across a 30-day window, zero statutory
 * deductions, and `net_pay` identical to `gross_pay` on every row. With them gone
 * the demo tenant holds a single finalized fortnight and the payroll pipeline is
 * no longer populated, so this restores it with records the real engine would
 * have produced.
 *
 * The pay math is `lib/payroll/schedule.ts`: `salaryFactorFor(frequency)` and
 * `fixedPayAmount(base_salary, factor)`. This script imports nothing because it
 * runs as plain Node, so the factor table is restated here — and
 * `tests/payroll-seed-window.test.ts` asserts this table still equals the engine's,
 * so the two cannot drift apart unnoticed.
 *
 * Safety:
 *   - Dry-run by default; `--apply` is required to write.
 *   - Refuses if the requested window overlaps an existing period, using the same
 *     inclusive-inclusive comparison as `periodsOverlap` and the
 *     `payroll_periods_no_overlap` constraint.
 *   - Refuses if any active employee has no `payroll_profiles` row, rather than
 *     quietly seeding a zero-pay record.
 *   - Writes records as `draft` inside a `draft` period, which is what the status
 *     coherence trigger requires.
 *
 * Run: node scripts/seed-payroll-window.mjs
 *      node scripts/seed-payroll-window.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

const BEEPA_ORG_ID = "11111111-1111-1111-1111-111111111111";

const argv = process.argv.slice(2);
const dryRun = !argv.includes("--apply");
const argValue = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const START = argValue("start", "2026-09-16");
const END = argValue("end", "2026-09-30");
const FREQUENCY = argValue("frequency", "semi_monthly");
const NAME = argValue("name", `September 16–30, 2026`);

/** Mirrors `salaryFactorFor` in lib/payroll/schedule.ts. */
const salaryFactorFor = (frequency) => {
  if (frequency === "monthly") return 1;
  if (frequency === "weekly") return 12 / 52;
  return 0.5;
};

/** Mirrors `fixedPayAmount` in lib/payroll/schedule.ts. */
const fixedPayAmount = (monthlySalary, factor) => Math.round(monthlySalary * factor * 100) / 100;

/** Mirrors `periodsOverlap`, inclusive-inclusive, matching daterange '[]'. */
const overlaps = (a, b) => a.start_date <= b.end_date && b.start_date <= a.end_date;

function env() {
  const out = {};
  if (!existsSync(".env.local")) throw new Error(".env.local missing");
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (process.env[k]) out[k] = process.env[k];
  }
  const key = out.SUPABASE_SECRET_KEY ?? out.SUPABASE_SERVICE_ROLE_KEY;
  if (!out.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL not found");
  if (!key) throw new Error("This script needs a privileged key");
  return { url: out.NEXT_PUBLIC_SUPABASE_URL, key };
}

const { url, key } = env();
const sb = createClient(url, key, { auth: { persistSession: false } });
console.log(`mode: ${dryRun ? "dry-run (no writes)" : "APPLY"}`);
console.log(`window: ${START} .. ${END}  (${FREQUENCY})`);

const { data: periods, error: pErr } = await sb
  .from("payroll_periods")
  .select("id, name, start_date, end_date, status")
  .eq("organization_id", BEEPA_ORG_ID)
  .limit(2000);
if (pErr) throw pErr;

for (const p of periods ?? []) console.log(`  existing: [${p.status}] ${p.name} ${p.start_date}..${p.end_date}`);

const clash = (periods ?? []).find((p) => overlaps(p, { start_date: START, end_date: END }));
if (clash) {
  console.error(`refusing: ${START}..${END} overlaps "${clash.name}" (${clash.start_date}..${clash.end_date})`);
  process.exitCode = 2;
} else {
  const { data: employees, error: eErr } = await sb
    .from("employees")
    .select("id, employee_number, job_title")
    .eq("organization_id", BEEPA_ORG_ID)
    .eq("employment_status", "active")
    .limit(500);
  if (eErr) throw eErr;

  const { data: profiles, error: prErr } = await sb
    .from("payroll_profiles")
    .select("employee_id, base_salary")
    .limit(1000);
  if (prErr) throw prErr;

  const salaryByEmployee = new Map();
  for (const row of profiles ?? []) salaryByEmployee.set(row.employee_id, Number(row.base_salary ?? 0));

  const missing = (employees ?? []).filter((e) => !salaryByEmployee.has(e.id));
  if (missing.length) {
    console.error(`refusing: ${missing.length} active employee(s) have no payroll_profiles row:`);
    for (const e of missing) console.error(`  ${e.id}`);
    process.exitCode = 2;
  } else {
    const factor = salaryFactorFor(FREQUENCY);
    const rows = (employees ?? []).map((e) => {
      const pay = fixedPayAmount(salaryByEmployee.get(e.id) ?? 0, factor);
      return {
        payroll_period_id: null,
        employee_id: e.id,
        status: "draft",
        basic_pay: pay,
        gross_pay: pay,
        net_pay: pay,
      };
    });

    const total = rows.reduce((s, r) => s + r.net_pay, 0);
    console.log(`\nactive employees: ${rows.length}`);
    console.log(`pay factor: ${factor}  gross total: ${total.toFixed(2)}`);
    for (const r of rows.slice(0, 5)) console.log(`  ${r.employee_id}  ${r.net_pay}`);
    if (rows.length > 5) console.log(`  ... and ${rows.length - 5} more`);

    if (dryRun) {
      console.log("\nre-run with --apply to create the period and its draft records.");
    } else {
      const { data: period, error: insErr } = await sb
        .from("payroll_periods")
        .insert({
          organization_id: BEEPA_ORG_ID,
          name: NAME,
          start_date: START,
          end_date: END,
          pay_date: END,
          pay_frequency: FREQUENCY,
          status: "draft",
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      const { error: recErr } = await sb
        .from("payroll_records")
        .insert(rows.map((r) => ({ ...r, payroll_period_id: period.id })));
      if (recErr) {
        // Do not leave an empty overlapping period behind.
        await sb.from("payroll_periods").delete().eq("id", period.id);
        throw recErr;
      }
      console.log(`\ncreated period ${period.id} with ${rows.length} draft record(s)`);
    }
  }
}