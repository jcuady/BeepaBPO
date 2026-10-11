// Delete payroll audit rows left behind by `qa-exercise-payroll-workflow.mjs`.
//
// WHY. The exercise created its own `payroll_periods` row and deleted it in `finally`, but
// never touched `audit_logs`. Each run therefore left `payroll.period.create`,
// `payroll.period.submit_approval`, `payroll.period.approve` and `payroll.recalculate` rows
// pointing at a period that no longer exists -- an audit trail for a subject that cannot be
// resolved. `qa-probe-payroll-audit-residue.mjs` found 15 such rows across three runs, which
// is more than the "3 stale payroll audit rows" this report previously carried: that count
// had only counted `payroll.recalculate`.
//
// SCOPE, in two independent constraints, both required:
//
//   1. The row is DANGLING -- its `entity_id` resolves to no live row **in its own table**.
//      `payroll_period` ids are checked against `payroll_periods` and `payroll_record` ids
//      against `payroll_records`. Checking both against one table makes live rows look like
//      safe deletion targets; an earlier version of the probe did exactly that.
//
//   2. It was written by a QA run, not by the seed. One dangling row predates the audit
//      effort (2026-09-22) and is seed provenance -- it records that a period was created
//      during seeding. It is reported and LEFT ALONE. Deleting it would remove real history
//      on the strength of a cleanup rule that was written to remove test residue.
//
// Nothing here can touch an audit row for a live period, or any pre-QA row.
//
// Usage: node scripts/audit/qa-cleanup-payroll-audit.mjs [--dry-run]

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, i).trim()] = v;
}

const DRY_RUN = process.argv.includes("--dry-run");
// The audit effort began in October 2026. Anything older is seed provenance, not residue.
const QA_EFFORT_START = "2026-10-01";

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const must = async (p, what) => {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
};

// In `main()` rather than at top level, because this script needs to return early from
// several places -- and a top-level `return` is a SyntaxError in an ES module.
async function main() {
const periods = await must(db.from("payroll_periods").select("id"), "periods");
const records = await must(db.from("payroll_records").select("id"), "records");
const liveByType = {
  payroll_period: new Set(periods.map((p) => p.id)),
  payroll_record: new Set(records.map((r) => r.id)),
};

const all = await must(
  db.from("audit_logs")
    .select("id, action, entity_type, entity_id, created_at")
    .in("entity_type", ["payroll_period", "payroll_record"]),
  "audit",
);

const dangling = all.filter((a) => !liveByType[a.entity_type]?.has(a.entity_id));
const preQa = dangling.filter((a) => a.created_at < QA_EFFORT_START);
const qaResidue = dangling.filter((a) => a.created_at >= QA_EFFORT_START);

console.log(`payroll audit rows: ${all.length}   live periods ${periods.length}   live records ${records.length}`);
console.log(`dangling: ${dangling.length}   of which pre-QA (seed, LEAVE): ${preQa.length}   QA residue: ${qaResidue.length}`);

for (const p of preQa) {
  console.log(`  KEEP (seed provenance)  ${p.created_at.slice(0, 10)}  ${p.action}  entity_id=${p.entity_id}`);
}
for (const r of qaResidue) {
  console.log(`  ${DRY_RUN ? "WILL DELETE" : "delete"}     ${r.created_at.slice(0, 10)}  ${r.action}  ${r.entity_type}  entity_id=${r.entity_id}`);
}

// No early return here. There are TWO residue classes -- audit rows AND approval requests --
// and returning when the first is empty skips the second. That is the same short-circuit bug
// this script had before, in a new place: the audit table was already clean, so "nothing to
// clean" printed and the one live approval request was never reached.
if (qaResidue.length > 0 && !DRY_RUN) {
  for (const r of qaResidue) {
    const { error } = await db.from("audit_logs").delete().eq("id", r.id);
    if (error) console.log(`  FAILED ${r.id}: ${error.message}`);
  }
} else if (qaResidue.length > 0) {
  console.log("\n--dry-run: audit rows not deleted");
}

const after = await must(
  db.from("audit_logs").select("id, created_at, entity_type, entity_id").in("entity_type", ["payroll_period", "payroll_record"]),
  "audit after",
);
const danglingAfter = after.filter(
  (a) => !liveByType[a.entity_type]?.has(a.entity_id) && a.created_at >= QA_EFFORT_START,
);

console.log(`\npayroll audit rows ${all.length} -> ${after.length}`);
console.log(`QA residue remaining: ${danglingAfter.length}`);
console.log(`pre-QA seed rows preserved: ${preQa.length}`);

// ---------------------------------------------------------------------------
// Approval requests, which is where the surviving dead LINK was hiding.
//
// `qa-exercise-internal-links.mjs` had stood at 28/29 with the failure written up as "audit
// history for a deleted record". That write-up was wrong. The payroll audit rows were cleaned
// up; what remained was a single `pending` `approval_requests` row from 2026-10-10 whose
// `entity_id` was a deleted period. The approvals queue renders a link from it, the crawler
// follows that link, and the target does not exist.
//
// SCOPE, three constraints, all required:
//   1. the request belongs to the `payroll` workflow -- NOT every approval request, which
//      would sweep in 23 leave requests and 2 cash advances;
//   2. its `entity_id` resolves to no live `payroll_periods` row;
//   3. it was created by a QA run, not by the seed (same date guard as above).
// `approval_actions` go first, because they reference the request.
// ---------------------------------------------------------------------------
const workflows = await must(db.from("approval_workflows").select("id, code"), "workflows");
const payrollWorkflowIds = new Set(workflows.filter((w) => w.code === "payroll").map((w) => w.id));

const requests = await must(
  db.from("approval_requests").select("id, workflow_id, entity_id, entity_type, status, created_at"),
  "approval_requests",
);
const payrollOnly = requests.filter((r) => payrollWorkflowIds.has(r.workflow_id) && r.entity_type === "payroll_period");
const staleRequests = payrollOnly.filter(
  (r) => !liveByType.payroll_period.has(r.entity_id) && r.created_at >= QA_EFFORT_START,
);

console.log(`\npayroll approval_requests: ${payrollOnly.length}   of which QA residue: ${staleRequests.length}`);
for (const r of staleRequests) {
  console.log(`  ${r.created_at.slice(0, 10)}  ${r.status}  entity_id=${r.entity_id}  request=${r.id}`);
}
for (const r of payrollOnly.filter((r) => liveByType.payroll_period.has(r.entity_id))) {
  console.log(`  KEEP (live period)  ${r.status}  entity_id=${r.entity_id}`);
}
for (const r of payrollOnly.filter((r) => !liveByType.payroll_period.has(r.entity_id) && r.created_at < QA_EFFORT_START)) {
  console.log(`  KEEP (pre-QA seed provenance)  ${r.created_at.slice(0, 10)}  entity_id=${r.entity_id}`);
}

if (staleRequests.length && !DRY_RUN) {
  const ids = staleRequests.map((r) => r.id);
  const { error: actErr } = await db.from("approval_actions").delete().in("request_id", ids);
  console.log(`  approval_actions ${actErr ? `FAILED ${actErr.message}` : "deleted"}`);
  const { error: reqErr } = await db.from("approval_requests").delete().in("id", ids);
  console.log(`  approval_requests ${reqErr ? `FAILED ${reqErr.message}` : "deleted"}`);
}

const requestsAfter = await must(
  db.from("approval_requests").select("id, workflow_id, entity_id, entity_type, created_at"),
  "approval_requests after",
);
const staleAfter = requestsAfter.filter(
  (r) => payrollWorkflowIds.has(r.workflow_id) && r.entity_type === "payroll_period" &&
    !liveByType.payroll_period.has(r.entity_id) && r.created_at >= QA_EFFORT_START,
);
const liveBefore = payrollOnly.filter((r) => liveByType.payroll_period.has(r.entity_id)).length;
const liveAfter = requestsAfter.filter(
  (r) => payrollWorkflowIds.has(r.workflow_id) && r.entity_type === "payroll_period" &&
    liveByType.payroll_period.has(r.entity_id),
).length;

console.log(`\nlive-period payroll approval_requests ${liveBefore} -> ${liveAfter} (must be unchanged)`);
console.log(`stale payroll approval_requests remaining: ${staleAfter.length}`);

const requestsOk = staleAfter.length === 0 && liveAfter === liveBefore;

const ok = danglingAfter.length === 0 && after.length === all.length - qaResidue.length && requestsOk;
if (DRY_RUN) {
  // Nothing was deleted, so the post-state checks above cannot pass by construction. Saying
  // "FAIL" after a --dry-run would be a lie about the database; say what a real run would do.
  console.log(`\n--dry-run: nothing deleted. A real run would remove ${qaResidue.length} audit row(s) and ${staleRequests.length} approval request(s).`);
  if (qaResidue.length === 0 && staleRequests.length === 0) console.log("--dry-run: nothing to clean");
} else {
  console.log(ok ? "\nOK  payroll QA residue cleared, seed provenance preserved" : "\nFAIL  rows did not settle as expected");
  if (!ok) process.exitCode = 1;
}
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exitCode = 1;
});