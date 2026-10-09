/**
 * Payroll record/period status coherence.
 *
 * `payroll_periods.status` and `payroll_records.status` are independent enums
 * and nothing in the schema keeps them consistent. The overlapping-period audit
 * surfaced a case that looks like a violation: a period still in `draft` whose
 * records are already `finalized`.
 *
 * That matters because:
 *   - Employees only see payslips for records in approved/finalized/paid, so a
 *     finalized record inside a draft period leaks into `/app/my/payroll` before
 *     the period has been approved.
 *   - Period approval finalizes the period *and* its records, so a record that
 *     is already `finalized` can be silently re-finalized or skipped depending
 *     on which path runs.
 *
 * Read-only. Reports coherence problems and their financial exposure.
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
const admin = createClient(
  e.NEXT_PUBLIC_SUPABASE_URL,
  e.SUPABASE_SECRET_KEY ?? e.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: periods, error } = await admin
  .from("payroll_periods")
  .select("id, name, start_date, end_date, status")
  .limit(500);
if (error) {
  console.error("FATAL: cannot read payroll_periods:", error.message);
  process.exit(1);
}

// Only periods that have not been approved can hold a premature record.
const open = (periods ?? []).filter((p) => !["finalized", "disbursed", "closed"].includes(p.status));
console.log(`Payroll periods: ${periods.length} total, ${open.length} not yet closed out.\n`);

const RANK = { draft: 0, preparing: 1, review: 2, approval: 3 };
let problems = 0;
let exposed = 0;

for (const period of open) {
  const { data: records } = await admin
    .from("payroll_records")
    .select("id, employee_id, status, net_pay")
    .eq("payroll_period_id", period.id)
    .limit(1000);

  const list = records ?? [];
  if (!list.length) continue;

  // A finalized/paid record is payable to the employee. It must not exist while
  // the period is still a draft or awaiting approval.
  const premature = list.filter((r) => ["finalized", "paid"].includes(r.status));
  if (!premature.length) continue;

  problems += 1;
  const net = premature.reduce((sum, r) => sum + Number(r.net_pay ?? 0), 0);
  exposed += net;

  const rank = RANK[period.status] ?? 0;
  const phase = period.status === "draft" ? "a draft" : `at '${period.status}'`;

  console.log(
    `INCOHERENT: period "${period.name}" (${period.start_date}..${period.end_date}) is ${phase}` +
      ` (rank ${rank}) but ${premature.length}/${list.length} record(s) are already finalized/paid.`,
  );
  console.log(`   Net pay payable before period approval: ${net}`);
  const byStatus = list.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`   Record statuses: ${JSON.stringify(byStatus)}`);
  console.log("");
}

console.log(`Incoherent periods: ${problems}`);
console.log(`Net pay exposed before approval: ${exposed}`);
console.log(
  problems === 0
    ? "VERDICT: all non-finalized periods contain only draft-stage records."
    : "VERDICT: records are payable before their period is approved. Reconcile before shipping.",
);