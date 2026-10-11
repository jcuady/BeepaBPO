// Read-only probe: can the client timesheet flow actually run in this environment?
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

const settings = await must(db.from("client_settings").select("*").limit(20), "client_settings");
console.log("client_settings rows:");
for (const s of settings) {
  console.log(`  org=${s.client_organization_id} allow_timesheet_approval=${s.allow_timesheet_approval}`);
}

const assignments = await must(
  db.from("employee_assignments").select("id, employee_id, client_organization_id, assignment_type, status").limit(200),
  "assignments",
);
const clientAssignments = assignments.filter((a) => a.assignment_type === "client" && a.status === "active" && a.client_organization_id);
console.log(`\nactive client assignments: ${clientAssignments.length}`);
const byEmployee = new Map();
for (const a of clientAssignments) byEmployee.set(a.employee_id, (byEmployee.get(a.employee_id) ?? 0) + 1);
const multi = [...byEmployee.entries()].filter(([, n]) => n > 1);
console.log(`employees with MORE THAN ONE active client assignment: ${multi.length} ${JSON.stringify(multi.slice(0, 5))}`);

const recs = await must(
  db.from("attendance_records").select("id, employee_id, work_date, approval_status").limit(2000),
  "attendance_records",
);
const statusCounts = {};
for (const r of recs) statusCounts[r.approval_status] = (statusCounts[r.approval_status] ?? 0) + 1;
console.log(`\nattendance_records total=${recs.length} by status: ${JSON.stringify(statusCounts)}`);

const assignedEmployees = new Set(clientAssignments.map((a) => a.employee_id));
const submittable = recs.filter(
  (r) => assignedEmployees.has(r.employee_id) && r.approval_status !== "client_review" && r.approval_status !== "finalized",
);
console.log(`\nrecords for client-assigned employees that are NOT client_review/finalized: ${submittable.length}`);
for (const r of submittable.slice(0, 5)) console.log(`  ${r.id.slice(0, 8)} ${r.work_date} ${r.approval_status}`);

const alreadyInReview = recs.filter((r) => assignedEmployees.has(r.employee_id) && r.approval_status === "client_review");
console.log(`\nrecords already in client_review: ${alreadyInReview.length}`);
for (const r of alreadyInReview.slice(0, 5)) console.log(`  ${r.id.slice(0, 8)} ${r.work_date}`);