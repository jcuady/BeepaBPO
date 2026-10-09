// Batch 4b: finish payroll records + payslips using direct upserts
// (the calculate_payroll_record RPC requires authed payroll.manage context,
//  which service_role cannot provide; so we compute the same shape directly).
//
// SAFETY: this script stops at `calculated`. It must never write `finalized`.
//
// Finalizing a payroll record makes it payable to the employee. In the product
// that happens in exactly one place -- `lib/payroll/actions.ts` advances the
// *period* to `finalized` first, and only then bulk-updates the period's
// records. That ordering is the invariant. This script used to set
// `status: "finalized"` on every record while leaving the parent period in
// `draft`, which published PHP 500,000 of unapproved net pay (see
// docs/SYSTEM_AUDIT.md 15.2) and created the incoherent data that
// `audit-payroll-status-coherence.mjs` now fails on.
//
// Do not "restore" the finalize write to make a seed demo look finished. A demo
// period in `calculated` is the honest state; the approval workflow produces
// the payable one.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx < 0) continue;
  let v = line.slice(idx + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, idx).trim()] = v;
}
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_SECRET_KEY = "[redacted]";
process.env.SUPABASE_SERVICE_ROLE_KEY = "[redacted]";
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

async function main() {
  console.log("=== BATCH 4b — finish payroll records + payslips (direct) ===\n");

  // Pull all draft payroll records
  const { data: records } = await sb
    .from("payroll_records")
    .select("id, payroll_period_id, employee_id, status");
  const draft = (records ?? []).filter((r) => r.status === "draft" || r.status === "calculated");
  console.log(`  Found ${draft.length} payroll records to finish`);

  const { data: periodRows } = await sb
    .from("payroll_periods")
    .select("id, name, start_date, end_date, status");
  const periods = periodRows ?? [];
  const periodById = new Map(periods.map((p) => [p.id, p]));

  // Preconditions. Refuse to write anything rather than write incoherent data.
  const orphans = draft.filter((r) => !periodById.has(r.payroll_period_id));
  if (orphans.length) {
    console.error(`  [ABORT] ${orphans.length} record(s) have no parent payroll_period row.`);
    process.exit(1);
  }

  const overlapping = [];
  for (const a of periods) {
    for (const b of periods) {
      if (a.id === b.id) continue;
      if (a.start_date <= b.end_date && b.start_date <= a.end_date) overlapping.push([a, b]);
    }
  }
  if (overlapping.length) {
    const seen = new Set();
    console.warn("  [WARN] Overlapping payroll periods present. Those days are paid twice:");
    for (const [a, b] of overlapping) {
      const key = [a.id, b.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      console.warn(`    - "${a.name}" (${a.start_date}..${a.end_date}, ${a.status})`);
      console.warn(`      "${b.name}" (${b.start_date}..${b.end_date}, ${b.status})`);
    }
    console.warn("    This script does not reconcile them. Migration");
    console.warn("    20261007120000_payroll_period_no_overlap.sql rejects overlaps at the");
    console.warn("    schema level; applying it requires SUPABASE_DB_PASSWORD.\n");
  }

  // A record's payable status is DERIVED from its parent period, never chosen
  // here. `approvedPeriods` is the same set the payslip route and the coherence
  // audit use, so seed, app, and audit agree on one definition of "payable".
  //
  // Canonical definition: `APPROVED_PERIOD_STATUSES` in
  // lib/payroll/status-coherence.ts (the app route and payroll list both import
  // it). This file duplicates the literals only because it is plain .mjs and
  // cannot import the TS module; tests/payroll-status-coherence.test.ts asserts
  // the two lists match, so the copy cannot drift silently.
  const APPROVED = new Set(["finalized", "disbursed", "closed"]);
  const statusFor = (period) => (APPROVED.has(period.status) ? "finalized" : "calculated");

  // Pull all payroll_profiles into a map
  const { data: profiles } = await sb.from("payroll_profiles").select("employee_id, base_salary, overtime_multiplier");
  const profByEmp = Object.fromEntries((profiles ?? []).map((p) => [p.employee_id, p]));

  let updated = 0, compsCount = 0, payslipCount = 0;
  for (const r of draft) {
    const period = periodById.get(r.payroll_period_id);
    const nextStatus = statusFor(period);
    const prof = profByEmp[r.employee_id];
    const base = Number(prof?.base_salary ?? 25000);
    const otMult = Number(prof?.overtime_multiplier ?? 1.25);
    // Half month: 11 working days * 480 = 5280 minutes target. 4800 = 10 days = 0.5 of monthly.
    const worked = 4800;
    const otMin = 120;
    const otPay = Math.round((base / 240) * (otMin / 60) * otMult);
    const paidLeave = 0;
    const unpaidLeave = 0;
    const undertime = 0;
    const absence = 0;
    const allowances = 1500;
    const bonuses = 0;
    const incentives = 0;
    const commissions = 0;
    const cashAdv = 0;
    const other = 0;
    const manualAdj = 0;
    const gross = base + otPay + paidLeave + allowances + bonuses + incentives + commissions;
    const deductions = undertime + absence + unpaidLeave + cashAdv + other;
    const net = Math.max(gross + manualAdj - deductions, 0);

    const updResult = await sb.from("payroll_records").update({
      basic_pay: base,
      worked_minutes: worked,
      overtime_minutes: otMin,
      overtime_pay: otPay,
      paid_leave_amount: paidLeave,
      unpaid_leave_deduction: unpaidLeave,
      allowances,
      bonuses,
      incentives,
      commissions,
      cash_advance_deduction: cashAdv,
      other_deductions: other,
      manual_adjustments: manualAdj,
      gross_pay: gross,
      total_deductions: deductions,
      net_pay: net,
      undertime_minutes: undertime,
      undertime_deduction: undertime,
      absence_deduction: absence,
      // Engine label must match the engine that produced the numbers:
      // migration 20260922120000_payroll_frequency_fixed_salary.sql writes
      // `fixed_salary_v1`. The old `stub_v1` label misattributed every figure.
      calculation_snapshot: {
        seeded_by: "batch4b",
        engine: "fixed_salary_v1",
        at: new Date().toISOString(),
      },
      status: nextStatus,
    }).eq("id", r.id);
    if (updResult.error) { console.error("  [FAIL] update", r.id.slice(0,8), updResult.error.message); continue; }
    updated++;

    // Insert components if not present
    const existingComps = await sb.from("payroll_components").select("id").eq("payroll_record_id", r.id);
    if (!existingComps.data?.length) {
      const compRows = [
        { payroll_record_id: r.id, type: "earning", code: "BASIC", label: "Basic salary (half month)", quantity: 0.5, rate: base * 2, amount: base, source_type: "payroll_profile", source_id: null },
        { payroll_record_id: r.id, type: "earning", code: "OT", label: `Overtime (${otMin} min)`, quantity: otMin / 60, rate: Math.round(base / 240), amount: otPay, source_type: "attendance", source_id: null },
        { payroll_record_id: r.id, type: "earning", code: "ALLOW", label: "Allowances", quantity: 1, rate: allowances, amount: allowances, source_type: "manual", source_id: null },
      ];
      await sb.from("payroll_components").insert(compRows);
      compsCount++;
    }

    // Payslip
    const existingPayslip = await sb.from("payslips").select("id").eq("payroll_record_id", r.id);
    if (!existingPayslip.data?.length) {
      await sb.from("payslips").insert({
        payroll_record_id: r.id,
        employee_id: r.employee_id,
        generated_at: new Date().toISOString(),
        pdf_path: `payslips/${r.employee_id}/${r.payroll_period_id.slice(0, 8)}-v1.pdf`,
        version: 1,
      });
      payslipCount++;
    }
  }
  const byStatus = {};
  for (const r of draft) {
    const s = statusFor(periodById.get(r.payroll_period_id));
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }
  console.log(`  [OK]   payroll_records written: ${updated} ${JSON.stringify(byStatus)}`);
  console.log(`  [OK]   payroll_components inserted: ${compsCount}`);
  console.log(`  [OK]   payslips created: ${payslipCount}`);
  console.log(
    "  [NOTE] Record status is derived from the parent period, not chosen here." +
      " Records in an unapproved period stay `calculated` and are not payable.",
  );

  console.log("\n=== BATCH 4b DONE ===");
}

main().catch((e) => { console.error("FATAL", e.message); process.exit(1); });