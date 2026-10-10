// Read-only snapshot of the attendance domain, so an exercise knows what it must
// preserve and what already exists. Prints shapes, not guesses.
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
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { count, error } = await db.from("attendance_records").select("id", { count: "exact", head: true });
console.log(`attendance_records: ${count}${error ? `  ERROR ${error.message}` : ""}`);

const { data: byStatus, error: e1 } = await db
  .from("attendance_records").select("approval_status").limit(2000);
console.log("  approval_status:", JSON.stringify(group(byStatus, "approval_status")), e1 ? `ERR ${e1.message}` : "");

const { data: byEmp, error: e2 } = await db
  .from("attendance_records").select("employee_id, work_date, status, approval_status, clock_in_at, clock_out_at, worked_minutes")
  .order("work_date", { ascending: false }).limit(6);
if (e2) console.log("  ERR", e2.message);
for (const r of byEmp ?? []) {
  console.log(`  ${String(r.work_date).slice(0, 10)} emp=${String(r.employee_id).slice(0, 8)} ${r.status}/${r.approval_status} in=${String(r.clock_in_at).slice(11, 16) ?? "-"} out=${String(r.clock_out_at).slice(11, 16) ?? "-"} mins=${r.worked_minutes ?? "-"}`);
}

const { count: cc, error: e3 } = await db.from("attendance_correction_requests").select("id", { count: "exact", head: true });
console.log(`correction_requests: ${cc}${e3 ? ` ERR ${e3.message}` : ""}`);

const { data: approvals, error: e4 } = await db
  .from("approval_requests").select("id, status, entity_type").eq("entity_type", "attendance_correction").limit(50);
if (e4) console.log("attendance_correction approvals ERR:", e4.message);
else console.log("attendance_correction approvals:", JSON.stringify(group(approvals, "status")));

const { data: wf, error: eWf } = await db.from("approval_workflows").select("code, active").eq("code", "attendance_correction");
if (eWf) console.log("workflow ERR:", eWf.message);
else console.log("workflow:", JSON.stringify(wf), wf?.length ? "" : "*** NO attendance_correction WORKFLOW ***");

const { data: wsteps, error: eWs } = await db.from("approval_steps").select("step_order, role_code, permission_code").eq("workflow_id", "22222222-2222-2222-2222-222222222202");
if (eWs) console.log("workflow steps ERR:", eWs.message);
else console.log("workflow steps:", JSON.stringify(wsteps));

const { data: assignments } = await db
  .from("employee_assignments").select("employee_id, client_organization_id, assignment_type, status").eq("assignment_type", "client").eq("status", "active");
console.log("active client assignments:", (assignments ?? []).length);
for (const a of assignments ?? []) console.log(`  emp=${String(a.employee_id).slice(0, 8)} client_org=${String(a.client_organization_id).slice(0, 8)}`);

const { data: cs } = await db.from("client_settings").select("client_organization_id, allow_timesheet_approval");
console.log("client_settings:", JSON.stringify(cs));

// Who can clock in? attendance.self holders with an employee record.
const { data: selfHolders } = await db.rpc("is_internal_user");
console.log("is_internal_user (service role):", selfHolders);

function group(rows, key) {
  const out = {};
  for (const r of rows ?? []) out[r[key] ?? "(null)"] = (out[r[key] ?? "(null)"] ?? 0) + 1;
  return out;
}