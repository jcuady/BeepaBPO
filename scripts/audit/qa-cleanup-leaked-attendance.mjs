// Remove the attendance record a broken cleanup pass leaked.
//
// WHY: qa-exercise-attendance-workflow.mjs dropped the created record's id from
// its cleanup set even when the UI delete had failed, so one row for employee
// 108f95ff on 2026-03-02 survived a run that reported "201 -> 202". Targeted by
// employee and date, never by a pattern.
//
// Dry run unless --apply.

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
const APPLY = process.argv.includes("--apply");

const EMPLOYEE = "108f95ff-e47f-414f-8ec2-0e49f075edb0";
const DATES = ["2026-03-02"];

const { data, error } = await db
  .from("attendance_records")
  .select("id, employee_id, work_date, status, approval_status, created_at")
  .eq("employee_id", EMPLOYEE)
  .in("work_date", DATES);
if (error) throw new Error(error.message);

console.log(`candidate rows for employee ${EMPLOYEE.slice(0, 8)} on ${DATES.join(", ")}: ${(data ?? []).length}`);
for (const r of data ?? []) {
  console.log(`  ${r.id}  ${r.work_date}  ${r.status}/${r.approval_status}  created=${r.created_at}`);
}
if (!(data ?? []).length) { console.log("\nnothing to clean"); process.exit(0); }
if (!APPLY) { console.log("\ndry run — pass --apply to delete"); process.exit(0); }

for (const r of data ?? []) {
  const { error: delErr } = await db.from("attendance_records").delete().eq("id", r.id);
  console.log(delErr ? `  FAILED ${r.id}: ${delErr.message}` : `  deleted ${r.id}`);
}
const { count } = await db.from("attendance_records").select("id", { count: "exact", head: true });
console.log(`\nattendance_records now: ${count}`);