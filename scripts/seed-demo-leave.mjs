/**
 * Seed demo leave history — READ-ONLY unless `--apply`.
 *
 * Why this exists (2026-10-09)
 * ----------------------------
 * `tests/live-data-smoke.test.ts` asserts `count("leave_requests") >= 1`. That
 * assertion had been passing for the wrong reason: no seed script ever creates
 * `leave_requests` (`seed-demo-extended.mts` only *dedupes* them), so every row
 * in the demo tenant was residue left behind by `e2e/mutations.spec.ts`. Once
 * that spec was fixed to clean up after itself, the smoke test started failing
 * for the honest reason — the table is genuinely empty.
 *
 * An empty table is also a weak demo: `/app/my/leave` renders "No leave requests
 * yet", and the e2e test "leave approve opens confirm and cancel does not mutate"
 * skips because there is nothing pending for HR to approve.
 *
 * Safety
 * ------
 *   - Dry-run by default. `--apply` is required to write anything.
 *   - Idempotent: re-running inserts nothing if history already exists, so it
 *     cannot pile up duplicates.
 *   - Never touches bereavement/leave-without-pay/maternity/parental types. Those
 *     read badly in a sales demo, and bereavement is exactly the type the old
 *     index-based e2e selection kept filing by accident.
 *   - Distinct (employee, dates) per row, because the live-data dedupe invariant
 *     requires that tuple to be unique.
 *
 * Run: node scripts/seed-demo-leave.mjs           # dry-run, prints the plan
 *      node scripts/seed-demo-leave.mjs --apply   # writes
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

function env() {
  const out = {};
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 0) continue;
      let x = line.slice(i + 1).trim();
      if ((x.startsWith('"') && x.endsWith('"')) || (x.startsWith("'") && x.endsWith("'"))) {
        x = x.slice(1, -1);
      }
      out[line.slice(0, i).trim()] = x;
    }
  }
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (process.env[key]) out[key] = process.env[key];
  }
  if (!out.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL not found");
  if (!(out.SUPABASE_SECRET_KEY ?? out.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("This script needs a privileged key (SUPABASE_SECRET_KEY)");
  }
  return out;
}

const e = env();
const sb = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY ?? e.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const dryRun = !process.argv.includes("--apply");
console.log(`mode: ${dryRun ? "dry-run (no writes)" : "APPLY"}`);

const AVOID = /bereavement|leave without pay|maternity|parental/i;

const { data: types, error: tErr } = await sb.from("leave_types").select("id, code, name");
if (tErr) throw tErr;
const safeTypes = (types ?? []).filter((t) => !AVOID.test(`${t.code} ${t.name ?? ""}`));
console.log(`leave types: ${safeTypes.length} usable of ${(types ?? []).length}`);
if (safeTypes.length === 0) {
  console.error("No safe leave types available. Refusing to seed.");
  process.exit(2);
}

// Employees that already have leave balances, so the seeded requests line up
// with balances the app can actually deduct against.
const { data: balances, error: bErr } = await sb.from("leave_balances").select("employee_id");
if (bErr) throw bErr;
const employeeIds = [...new Set((balances ?? []).map((b) => b.employee_id).filter(Boolean))].slice(0, 6);
console.log(`employees with balances: ${employeeIds.length}`);

const { count: existing } = await sb
  .from("leave_requests")
  .select("*", { count: "exact", head: true });
console.log(`leave_requests currently: ${existing ?? 0}`);

if ((existing ?? 0) > 0) {
  console.log("\nnothing to do — history already exists. This script never merges into existing data.");
  process.exit(0);
}

const iso = (d) => d.toISOString().slice(0, 10);
const at = (d) => `${iso(d)}T00:00:00+00:00`;
const endOf = (d) => `${iso(d)}T23:59:59.999+00:00`;
const day = 24 * 60 * 60 * 1000;

// Spread across past months so the list reads as history, plus rows that are
// genuinely mid-workflow so /app/leave is not an empty table in a demo.
// `offsetDays` is relative to today: negative is in the past.
//
// The workflow states are snake_case (`manager_approved`, `hr_approved`) — that is
// what `leave_requests.status` stores, and it is *not* the spaced form shown in
// the status filter dropdown. Getting that wrong silently produces rows no
// approval step can match.
const PLAN = [
  { offsetDays: -152, days: 1, type: 0, status: "approved", reason: "Family trip" },
  { offsetDays: -121, days: 1, type: 1, status: "approved", reason: "Medical appointment" },
  { offsetDays: -92, days: 2, type: 2, status: "approved", reason: "Rest days" },
  { offsetDays: -63, days: 1, type: 0, status: "approved", reason: "Long weekend" },
  { offsetDays: -34, days: 1, type: 2, status: "approved", reason: "Personal day" },
  { offsetDays: 12, days: 1, type: 1, status: "pending", reason: "Upcoming appointment" },
  { offsetDays: 30, days: 1, type: 1, status: "manager_approved", reason: "Awaiting HR review" },
];

const rows = [];
employeeIds.forEach((employeeId, idx) => {
  // Each employee gets a couple of requests; dates are offset per employee so no
  // two rows share (employee, start, end).
  const picks = idx === 0 ? PLAN : PLAN.slice(0, 2);
  picks.forEach((p, n) => {
    const start = new Date(Date.now() + (p.offsetDays + n * 2 + idx * 3) * day);
    const end = new Date(start.getTime() + (p.days - 1) * day);
    const type = safeTypes[p.type % safeTypes.length];
    rows.push({
      employee_id: employeeId,
      leave_type_id: type.id,
      start_at: at(start),
      end_at: endOf(end),
      status: p.status,
      reason: p.reason,
      requested_minutes: p.days * 480,
    });
  });
});

const today = iso(new Date());
const pastPending = rows.filter((r) => r.status === "pending" && r.start_at.slice(0, 10) <= today);
if (pastPending.length) {
  console.error(
    `\nREFUSING TO WRITE: ${pastPending.length} pending request(s) start on or before today ` +
      `(${pastPending.map((r) => r.start_at.slice(0, 10)).join(", ")}). A pending request that ` +
      `has already started reads as a data error in a demo.`,
  );
  process.exit(2);
}

console.log(`\nwould insert ${rows.length} row(s):`);
for (const r of rows) {
  console.log(`  ${r.employee_id} ${r.start_at.slice(0, 10)} -> ${r.end_at.slice(0, 10)} [${r.status}] ${r.reason}`);
}

if (dryRun) {
  console.log("\nre-run with --apply to write");
  process.exit(0);
}

const { error: insErr } = await sb.from("leave_requests").insert(rows);
if (insErr) throw insErr;

const { count: after } = await sb.from("leave_requests").select("*", { count: "exact", head: true });
console.log(`\ninserted. leave_requests is now: ${after}`);