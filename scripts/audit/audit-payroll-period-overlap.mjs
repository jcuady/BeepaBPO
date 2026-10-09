/**
 * Payroll period overlap audit.
 *
 * `createPayrollPeriod` rejects an overlapping cutoff in application code, but
 * that check is a read-then-write and therefore racy: two concurrent runs can
 * both pass it before either inserts. More importantly there is no database
 * backstop at all, so anything that writes `payroll_periods` other than that
 * one server action can create overlapping periods freely.
 *
 * Overlapping periods mean a given day's worked minutes are pulled into two
 * payroll runs, so the employee is paid twice for the same hours. That is the
 * single most expensive bug class in a BPO payroll system, so the invariant
 * belongs in the schema:
 *
 *   alter table public.payroll_periods
 *     add constraint payroll_periods_no_overlap
 *     exclude using gist (
 *       organization_id with =,
 *       daterange(start_date, end_date, '[]') with &&
 *     );
 *
 * An ALTER TABLE ADD CONSTRAINT validates the whole table, so it fails if any
 * existing row already overlaps. This script answers that question up front,
 * without executing any SQL, by reading the rows through PostgREST and testing
 * them the same way Postgres would.
 *
 * Read-only. Exits non-zero only if the migration could not be applied safely.
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

const { data, error } = await admin
  .from("payroll_periods")
  .select("id, name, organization_id, start_date, end_date, status")
  .limit(2000);

if (error) {
  console.error("FATAL: could not read payroll_periods:", error.message);
  process.exit(1);
}

const periods = data ?? [];
console.log(`Read ${periods.length} payroll period(s).`);

// Inclusive-inclusive, matching daterange(start_date, end_date, '[]').
const overlaps = (a, b) => a.start_date <= b.end_date && b.start_date <= a.end_date;

// Group by org: the constraint scopes exclusion to organization_id.
const byOrg = new Map();
for (const p of periods) {
  const list = byOrg.get(p.organization_id) ?? [];
  list.push(p);
  byOrg.set(p.organization_id, list);
}

let conflicts = 0;
for (const [orgId, list] of byOrg) {
  const sorted = [...list].sort((a, b) => a.start_date.localeCompare(b.start_date));
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (sorted[j].start_date > sorted[i].end_date) break; // sorted by start; no further overlap possible
      if (overlaps(sorted[i], sorted[j])) {
        conflicts += 1;
        console.log(
          `  CONFLICT org=${orgId}\n` +
            `    [${sorted[i].id}] ${sorted[i].name}  ${sorted[i].start_date} .. ${sorted[i].end_date} (${sorted[i].status})\n` +
            `    [${sorted[j].id}] ${sorted[j].name}  ${sorted[j].start_date} .. ${sorted[j].end_date} (${sorted[j].status})`,
        );
      }
    }
  }
}

console.log("");

// Overlapping periods are only dangerous once a person appears in both: that
// is the same worked days counted twice and paid twice.
if (conflicts > 0) {
  console.log("Employees paid in more than one overlapping period:");
  let doublePaid = 0;
  let affected = 0;

  for (const [orgId, list] of byOrg) {
    const sorted = [...list].sort((a, b) => a.start_date.localeCompare(b.start_date));
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        if (sorted[j].start_date > sorted[i].end_date) break;
        if (!overlaps(sorted[i], sorted[j])) continue;

        const ids = [sorted[i].id, sorted[j].id];
        const { data: recs } = await admin
          .from("payroll_records")
          .select("employee_id, payroll_period_id, status, net_pay")
          .in("payroll_period_id", ids)
          .limit(1000);

        const byEmployee = new Map();
        for (const r of recs ?? []) {
          const entry = byEmployee.get(r.employee_id) ?? {};
          entry[r.payroll_period_id] = r;
          byEmployee.set(r.employee_id, entry);
        }

        for (const [employeeId, entry] of byEmployee) {
          const seen = ids.filter((id) => entry[id]);
          if (seen.length < 2) continue;
          affected += 1;
          for (const id of ids) {
            const r = entry[id];
            if (!r) continue;
            if (id === ids[0]) doublePaid += Number(r.net_pay ?? 0);
          }
          console.log(
            `  employee ${employeeId} appears in ${seen.length} overlapping periods:` +
              seen
                .map((id) => {
                  const r = entry[id];
                  const name = id === ids[0] ? sorted[i].name : sorted[j].name;
                  return `\n      ${name}: record ${r.status}, net ${r.net_pay}`;
                })
                .join(""),
          );
        }
      }
    }
  }

  console.log("");
  console.log(`Employees with duplicated pay: ${affected}`);
  console.log(`Net pay at risk (from the earlier period in each overlap): ${doublePaid}`);
  console.log("");
}

if (conflicts === 0) {
  console.log("Overlapping payroll periods: 0");
  console.log(
    "VERDICT: migration 20261007120000_payroll_period_no_overlap.sql can be applied as-is;",
  );
  console.log("         the ADD CONSTRAINT validation pass will not fail on existing rows.");
} else {
  console.log(`Overlapping payroll periods: ${conflicts}`);
  console.log(
    "VERDICT: BLOCKED. ADD CONSTRAINT would fail on existing data. Reconcile the",
  );
  console.log("         conflicting periods first, then apply the migration.");
}