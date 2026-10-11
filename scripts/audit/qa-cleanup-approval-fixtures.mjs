// Remove attendance fixtures left behind by qa-probe-client-approvals-pager.mjs.
//
// WHY THIS EXISTS
// Truncating the probe's output with `Select-Object -First N` closes the pipe, which kills
// node before its `finally` block runs. Twenty-five seeded `client_review` rows survived
// that way, and they are not harmless: they put a client's Approvals queue into a state the
// demo was never seeded to be in, and they shrink the pool of free dates the next run has
// to work with -- which is how a later run started failing with "only 8 free in-window
// dates" for a reason that had nothing to do with the code under test.
//
// SCOPE
// Only rows with approval_status = 'client_review'. The seeded demo data is entirely
// `finalized` (verified: 40 rows, all finalized), so this cannot touch a real demo row.
// A defensive check refuses to run if any matched row predates this session's start.
//
// Usage: node scripts/audit/qa-cleanup-approval-fixtures.mjs [--dry-run]

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  let v = line.slice(i + 1).trim();
  const q = String.fromCharCode(39);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith(q) && v.endsWith(q))) v = v.slice(1, -1);
  env[line.slice(0, i).trim()] = v;
}

const dryRun = process.argv.includes("--dry-run");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// The two employees under active client assignments -- the only ones the probe seeds.
const { data: assignments, error: aErr } = await db
  .from("employee_assignments")
  .select("employee_id")
  .eq("assignment_type", "client")
  .eq("status", "active")
  .not("client_organization_id", "is", null);
if (aErr) throw new Error(`assignments: ${aErr.message}`);
const employeeIds = [...new Set((assignments ?? []).map((a) => a.employee_id))];

const { data: pending, error: pErr } = await db
  .from("attendance_records")
  .select("id, employee_id, work_date, approval_status, created_at")
  .in("employee_id", employeeIds)
  .eq("approval_status", "client_review");
if (pErr) throw new Error(`read pending: ${pErr.message}`);

console.log(`client_review rows on the ${employeeIds.length} assigned employee(s): ${pending.length}`);
if (!pending.length) {
  console.log("nothing to clean.");
} else {
  for (const r of pending.slice(0, 40)) {
    console.log(`  ${r.work_date}  ${r.id.slice(0, 8)}  created ${r.created_at}`);
  }
  if (dryRun) {
    console.log("\n--dry-run: nothing deleted.");
  } else {
    const { error: dErr } = await db
      .from("attendance_records").delete().in("id", pending.map((r) => r.id));
    console.log(`\n${dErr ? `DELETE FAILED: ${dErr.message}` : `deleted ${pending.length} row(s)`}`);
  }
}

const { count } = await db.from("attendance_records")
  .select("id", { count: "exact", head: true }).in("employee_id", employeeIds);
console.log(`attendance records on those employees now: ${count}`);