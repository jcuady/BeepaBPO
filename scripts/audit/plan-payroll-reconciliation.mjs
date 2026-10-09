/**
 * Payroll reconciliation planner — READ-ONLY.
 *
 * Two release-gate steps fail today:
 *   - overlapping payroll periods (Sept 1-15 sits inside Sept 1-30)
 *   - records finalized inside an unapproved period
 *
 * Both need a business decision, and until now that decision has been posed as
 * three words long ("retire", "shrink", "retire") with none of the
 * consequences attached. That is how someone deletes a payslip by accident.
 *
 * This script performs no writes. It reads the periods, records, components,
 * payslips and cash-advance deductions, then prints, for each option, the exact
 * SQL and everything that SQL would take with it.
 *
 * The two findings that change the decision, both from the schema rather than
 * from this script's opinions:
 *
 *   1. `payroll_records.payroll_period_id` is `on delete cascade`, and
 *      `payslips.payroll_record_id` is `on delete cascade` too. Deleting a
 *      period does not "retire" it — it deletes the payslips employees read in
 *      `/app/my/payroll`, along with their payroll_components.
 *   2. `cash_advance_deductions.payroll_record_id` and
 *      `payroll_approvals.payroll_record_id` are `on delete set null`, so those
 *      rows survive with a dangling null: a deduction that silently stops
 *      pointing at the pay it was deducted from.
 *
 * And the one that rules out an obvious shortcut:
 *
 *   3. Migration `20261007120000_payroll_period_no_overlap.sql` adds an
 *      EXCLUDE constraint on `payroll_periods.daterange(start_date, end_date)`.
 *      It constrains *periods*, not records. Voiding the duplicated payroll
 *      records therefore fixes the double payment but leaves the ADD CONSTRAINT
 *      validation failing, so the migration still cannot be applied. Only a
 *      change to the periods themselves clears that step.
 *
 * Run: node scripts/audit/plan-payroll-reconciliation.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

function env() {
  if (!existsSync(".env.local")) throw new Error(".env.local missing");
  const out = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let x = line.slice(i + 1).trim();
    if ((x.startsWith('"') && x.endsWith('"')) || (x.startsWith("'") && x.endsWith("'"))) x = x.slice(1, -1);
    out[line.slice(0, i).trim()] = x;
  }
  return out;
}

const e = env();
const admin = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY ?? e.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const money = (n) => `PHP ${Number(n ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const { data: periodRows, error } = await admin
  .from("payroll_periods")
  .select("id, name, organization_id, start_date, end_date, status")
  .order("start_date");
if (error) {
  console.error("FATAL: cannot read payroll_periods:", error.message);
  process.exit(1);
}
const periods = periodRows ?? [];

const overlaps = (a, b) => a.start_date <= b.end_date && b.start_date <= a.end_date;

const byOrg = new Map();
for (const p of periods) {
  const list = byOrg.get(p.organization_id) ?? [];
  list.push(p);
  byOrg.set(p.organization_id, list);
}

/** Every row reachable by deleting `periodId`, following the FK cascade. */
async function blastRadius(periodId) {
  const { data: recs } = await admin
    .from("payroll_records")
    .select("id, employee_id, status, net_pay")
    .eq("payroll_period_id", periodId)
    .limit(5000);
  const records = recs ?? [];
  const recordIds = records.map((r) => r.id);

  let components = 0;
  let payslips = [];
  if (recordIds.length) {
    const [{ data: comps }, { data: slips }] = await Promise.all([
      admin.from("payroll_components").select("id").in("payroll_record_id", recordIds).limit(5000),
      admin
        .from("payslips")
        .select("id, employee_id, payroll_record_id")
        .in("payroll_record_id", recordIds)
        .limit(5000),
    ]);
    components = (comps ?? []).length;
    payslips = slips ?? [];
  }

  // on delete set null: these rows are NOT destroyed, they just lose the link.
  let danglingDeductions = 0;
  let danglingAmount = 0;
  let danglingApprovals = 0;
  if (recordIds.length) {
    const [{ data: deductions }, { data: approvals }] = await Promise.all([
      admin
        .from("cash_advance_deductions")
        .select("id, amount")
        .in("payroll_record_id", recordIds)
        .limit(5000),
      admin
        .from("payroll_approvals")
        .select("id")
        .in("payroll_record_id", recordIds)
        .limit(5000),
    ]);
    danglingDeductions = (deductions ?? []).length;
    danglingAmount = (deductions ?? []).reduce((s, d) => s + Number(d.amount ?? 0), 0);
    danglingApprovals = (approvals ?? []).length;
  }

  const net = records.reduce((s, r) => s + Number(r.net_pay ?? 0), 0);
  const employees = new Set(records.map((r) => r.employee_id));
  return {
    records,
    recordCount: records.length,
    net,
    employees: employees.size,
    components,
    payslips,
    danglingDeductions,
    danglingAmount,
    danglingApprovals,
  };
}

function printBlast(label, b) {
  console.log(`      ${label}`);
  console.log(`        payroll_records   ${b.recordCount} row(s), net ${money(b.net)}, ${b.employees} employee(s)`);
  console.log(`        payroll_components ${b.components} row(s)   [DELETE CASCADE]`);
  console.log(`        payslips           ${b.payslips.length} row(s)   [DELETE CASCADE]  <-- employees lose these`);
  if (b.danglingDeductions) {
    console.log(
      `        cash_adv_deductions ${b.danglingDeductions} row(s), ${money(b.danglingAmount)}   [SET NULL — survive, unlinked]`,
    );
  }
  if (b.danglingApprovals) {
    console.log(`        payroll_approvals  ${b.danglingApprovals} row(s)   [SET NULL — survive, unlinked]`);
  }
}

console.log(`Payroll periods: ${periods.length}\n`);

const pairs = [];
for (const [orgId, list] of byOrg) {
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (overlaps(list[i], list[j])) pairs.push({ orgId, a: list[i], b: list[j] });
    }
  }
}

if (pairs.length === 0) {
  console.log("VERDICT: no overlapping periods. Nothing to reconcile.");
  process.exit(0);
}

for (const { orgId, a, b } of pairs) {
  const [early, late] = a.start_date <= b.start_date ? [a, b] : [b, a];
  const overlapStart = late.start_date > early.start_date ? late.start_date : early.start_date;
  const overlapEnd = early.end_date < late.end_date ? early.end_date : late.end_date;

  console.log("=".repeat(78));
  console.log(`OVERLAP  org=${orgId}`);
  console.log(
    `  earlier  [${early.id}] "${early.name}"  ${early.start_date} .. ${early.end_date}  (${early.status})`,
  );
  console.log(`  later    [${late.id}]  "${late.name}"  ${late.start_date} .. ${late.end_date}  (${late.status})`);
  console.log(`  shared days: ${overlapStart} .. ${overlapEnd}`);
  console.log("=".repeat(78));

  const earlyB = await blastRadius(early.id);
  const lateB = await blastRadius(late.id);

  // Employees present in both periods: the actual double payment.
  const earlyByEmp = new Map(earlyB.records.map((r) => [r.employee_id, r]));
  const dupes = lateB.records.filter((r) => earlyByEmp.has(r.employee_id));
  const dupeNet = dupes.reduce((s, r) => s + Number(r.net_pay ?? 0), 0);
  console.log(`\n  Double-paid: ${dupes.length} employee(s)\n`);
  for (const lateRec of dupes) {
    const earlyRec = earlyByEmp.get(lateRec.employee_id);
    const same = Number(earlyRec.net_pay ?? 0) === Number(lateRec.net_pay ?? 0);
    console.log(`      employee ${lateRec.employee_id}`);
    console.log(`        "${early.name}": ${money(earlyRec.net_pay)} (${earlyRec.status})`);
    console.log(`        "${late.name}":  ${money(lateRec.net_pay)} (${lateRec.status})`);
    if (!same) {
      console.log(
        `        ^ THE TWO DISAGREE. These are not the same computation stored twice, so "delete one" is not\n` +
          `          obviously safe: the two runs computed different figures for the same shared days. Someone who\n` +
          `          knows how each was calculated has to say which one is correct.`,
      );
    }
    console.log("");
  }

  console.log("  OPTION A — delete the later period, keep the earlier one");
  printBlast(`deleting [${late.id}] "${late.name}"`, lateB);
  console.log("      SQL:");
  console.log(`        delete from public.payroll_periods where id = '${late.id}';`);
  const unpaidAfterA = lateB.recordCount;
  console.log(
    `      This is NOT "keep the good one". Read what is left:\n` +
      `        - "${late.name}" is gone entirely: ${unpaidAfterA} employee(s) lose their September pay, and\n` +
      `          ${lateB.payslips.length} payslip(s) are cascade-deleted out from under them.\n` +
      `        - "${early.name}" survives but holds only ${earlyB.recordCount} record(s).\n` +
      `        - Net result: only ${earlyB.recordCount} of ${unpaidAfterA} employee(s) is paid for Sept 1-15 and\n` +
      `          NOBODY is paid for Sept 16-30. A new period covering 2026-09-16 .. 2026-09-30 must be created\n` +
      `          and run, or September simply goes out short.`,
  );
  console.log("");

  console.log("  OPTION B — shrink the later period to start after the overlap ends");
  console.log(`      SQL:`);
  console.log(`        update public.payroll_periods set start_date = date '${dayAfter(overlapEnd)}' where id = '${late.id}';`);
  console.log(
    `      Deletes nothing, but the ${lateB.recordCount} record(s) in "${late.name}" still carry amounts computed\n` +
      `      across the FULL month (${money(lateB.net)}). After the date change those figures are stale and must be\n` +
      `      recalculated, and the payslips already generated from them (${lateB.payslips.length}) become wrong rather\n` +
      `      than missing. Noisiest option: it looks like a one-line fix and is not.\n`,
  );

  console.log("  OPTION C — delete the earlier period, keep the later one");
  printBlast(`deleting [${early.id}] "${early.name}"`, earlyB);
  console.log("      SQL:");
  console.log(`        delete from public.payroll_periods where id = '${early.id}';`);
  console.log(
    `      Discards a FINALIZED period. Any of its records that are already 'paid' represent money that has\n` +
      `      actually left the company, so this option is only correct if nothing was disbursed.\n`,
  );

  // Coherence: records payable before their period is approved.
  const premature = [earlyB, lateB]
    .map((x, i) => ({ ...x, period: i === 0 ? early : late }))
    .filter((x) => !["finalized", "disbursed", "closed"].includes(x.period.status))
    .flatMap((x) => x.records.filter((r) => ["finalized", "paid"].includes(r.status)));
  if (premature.length) {
    const net = premature.reduce((s, r) => s + Number(r.net_pay ?? 0), 0);
    console.log(`  SEPARATE — ${premature.length} record(s) are finalized inside an unapproved period`);
    console.log(`      Payable before approval: ${money(net)}`);
    console.log(`      Recommended: set them back to 'draft'. Migration 20261007130000 adds a trigger that`);
    console.log(`      rejects any future finalized/paid record under an unapproved period, so leaving these`);
    console.log(`      would put the database permanently out of step with its own rule.`);
    console.log("      SQL:");
    console.log(
      `        update public.payroll_records set status = 'draft'\n` +
        `        where status in ('finalized','paid')\n` +
        `          and payroll_period_id in (select id from public.payroll_periods\n` +
        `                                where status not in ('finalized','disbursed','closed'));`,
    );
  }
  console.log("");
}

console.log("=".repeat(78));
console.log("This script changed nothing. Pick an option, then run it inside a transaction:");
console.log("  begin;");
console.log("  <the SQL above>");
console.log("  -- inspect, then:  commit;  or  rollback;");
console.log("=".repeat(78));

function dayAfter(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}