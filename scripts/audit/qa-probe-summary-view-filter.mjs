// Why does a freshly created client_review record not appear in
// client_attendance_summary, while that employee's pre-existing records do?
//
// Method: create the record exactly as the exercise does, then walk the view's possible
// predicates one at a time, reading the view after each change. Whichever single field
// makes the row appear names the predicate that was excluding it.

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
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}

const WORK_DATE = "2026-06-15";

const { data: settings } = await db.from("client_settings").select("client_organization_id").eq("allow_timesheet_approval", true).limit(1).maybeSingle();
const { data: assignment } = await db
  .from("employee_assignments")
  .select("id, employee_id, client_organization_id, start_date, end_date, status, assignment_type")
  .eq("client_organization_id", settings.client_organization_id)
  .eq("assignment_type", "client")
  .eq("status", "active")
  .limit(1)
  .maybeSingle();
console.log(`employee ${assignment.employee_id.slice(0, 8)}, assignment start=${assignment.start_date} end=${assignment.end_date}`);

const existing = await must(
  db.from("client_attendance_summary").select("attendance_record_id, work_date, approval_status").eq("employee_id", assignment.employee_id).limit(5),
  "existing view rows for this employee",
);
console.log(`\nexisting view rows for this employee: ${existing.length}`);
for (const r of existing) console.log(`  ${String(r.attendance_record_id).slice(0, 8)} ${r.work_date} ${r.approval_status}`);
if (existing.length) {
  console.log(`  -> the earliest one in the view is ${existing[existing.length - 1].work_date}`);
}

const made = await must(
  db.from("attendance_records").insert({
    employee_id: assignment.employee_id,
    work_date: WORK_DATE,
    clock_in_at: `${WORK_DATE}T08:00:00+08:00`,
    clock_out_at: `${WORK_DATE}T17:00:00+08:00`,
    worked_minutes: 480,
    break_minutes: 60,
    status: "present",
    approval_status: "client_review",
  }).select("id, work_date, approval_status"),
  "insert",
);
const id = made[0].id;
console.log(`\ncreated ${id.slice(0, 8)} on ${made[0].work_date} status=${made[0].approval_status}`);
console.log(`(assignment window starts ${assignment.start_date}, ends ${assignment.end_date ?? "open"})`);

async function inView(label) {
  const rows = await must(
    db.from("client_attendance_summary").select("attendance_record_id, approval_status").eq("attendance_record_id", id),
    `view check: ${label}`,
  );
  console.log(`  ${rows.length > 0 ? "IN VIEW " : "absent  "} ${label}`);
  return rows.length > 0;
}

// Walk free work_dates across the assignment window instead of moving this one: the
// first attempt tried to move onto a date the employee already had a record for, so the
// unique (employee_id, work_date) constraint rejected the UPDATE, the error was not
// read, and the "same employee, same date" test silently re-ran the previous one.
const taken = new Set(
  (
    await must(
      db.from("attendance_records").select("work_date").eq("employee_id", assignment.employee_id).limit(2000),
      "taken dates",
    )
  ).map((r) => r.work_date),
);
const candidates = ["2026-06-15", "2026-09-04", "2026-09-06", "2026-09-10", "2026-11-02"].filter(
  (d) => !taken.has(d),
);
console.log(`\nfree candidate dates: ${candidates.join(", ")}`);

console.log("\nwalking the view's possible predicates:");
let everAppeared = await inView(`work_date = ${WORK_DATE} (before the assignment start)`);

for (const d of candidates.slice(1)) {
  const { error } = await db.from("attendance_records").update({ work_date: d }).eq("id", id);
  if (error) {
    console.log(`  (skipped ${d}: ${error.message})`);
    continue;
  }
  if (await inView(`work_date = ${d}`)) everAppeared = true;
}

if (everAppeared) {
  console.log("\n=> work_date is the filter: the view only covers the assignment window.");
} else {
  console.log("\n=> not the date. Trying approval_status = finalized on this same row:");
  const { error } = await db.from("attendance_records").update({ approval_status: "finalized" }).eq("id", id);
  if (error) console.log(`  (update failed: ${error.message})`);
  else await inView("approval_status = finalized");
}

await db.from("attendance_records").delete().eq("id", id);
const gone = await must(db.from("client_attendance_summary").select("attendance_record_id").eq("attendance_record_id", id), "final view check");
console.log(`\ncleanup: fixture deleted, rows left in view for it: ${gone.length}`);
const total = await db.from("attendance_records").select("id", { count: "exact", head: true });
console.log(`attendance_records total: ${total.count}`);