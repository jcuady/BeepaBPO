// Does public.client_attendance_summary really hide attendance days outside the assignment
// window? This is the check I got wrong once.
//
// The first time I examined the view I read an EARLIER definition (20260906001300) and the
// grep context was cut off at `and ea.status = 'active'`, so I concluded the view had no
// date filter and used that to tell the owner a real P1 was a measurement error. The
// current definition, 20260907180000, ends with:
//
//   and (ea.start_date is null or ar.work_date >= ea.start_date)
//   and (ea.end_date   is null or ar.work_date <= ea.end_date)
//
// A truncated context read is not evidence of absence. This compares the two populations
// directly: every attendance record belonging to an actively-assigned employee, against the
// records the view actually returns.
//
// Usage: node scripts/audit/qa-probe-client-timesheet-window.mjs

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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: assignments, error: aErr } = await admin
  .from("employee_assignments")
  .select("employee_id, client_organization_id, start_date, end_date, status")
  .eq("assignment_type", "client")
  .eq("status", "active")
  .not("client_organization_id", "is", null);
if (aErr) throw new Error(`assignments: ${aErr.message}`);

const employeeIds = [...new Set(assignments.map((a) => a.employee_id))];
console.log(`active client assignments: ${assignments.length} covering ${employeeIds.length} employees\n`);

const { data: records, error: rErr } = await admin
  .from("attendance_records")
  .select("id, employee_id, work_date, approval_status")
  .in("employee_id", employeeIds);
if (rErr) throw new Error(`records: ${rErr.message}`);

const { data: view, error: vErr } = await admin
  .from("client_attendance_summary")
  .select("attendance_record_id, work_date, approval_status");
if (vErr) throw new Error(`view: ${vErr.message}`);

const visible = new Set(view.map((r) => r.attendance_record_id));
console.log(`attendance records for those employees: ${records.length}`);
console.log(`rows the view returns:                  ${view.length}`);

const missing = records.filter((r) => !visible.has(r.id));

// Classify each hidden record against the assignment window, so the reason is explicit
// rather than inferred.
function windowFor(employeeId, workDate) {
  const a = assignments.find((x) => x.employee_id === employeeId);
  if (!a) return { verdict: "no assignment row", a };
  const beforeStart = a.start_date && workDate < a.start_date;
  const afterEnd = a.end_date && workDate > a.end_date;
  return { verdict: beforeStart ? "work_date < start_date" : afterEnd ? "work_date > end_date" : "within window?", a };
}

const byVerdict = new Map();
for (const r of missing) {
  const { verdict, a } = windowFor(r.employee_id, r.work_date);
  if (!byVerdict.has(verdict)) byVerdict.set(verdict, []);
  byVerdict.get(verdict).push({ ...r, start: a.start_date, end: a.end_date });
}

console.log(`\nrecords INVISIBLE to the client: ${missing.length}`);
for (const [verdict, rows] of byVerdict) {
  console.log(`\n  ${verdict}: ${rows.length}`);
  for (const r of rows.slice(0, 6)) {
    console.log(`    work_date=${r.work_date}  assignment=${r.start ?? "null"} .. ${r.end ?? "null"}  status=${r.approval_status}  record=${r.id.slice(0, 8)}`);
  }
  if (rows.length > 6) console.log(`    ... and ${rows.length - 6} more`);
}

const hiddenByWindow = [...byVerdict.entries()]
  .filter(([k]) => k !== "within window?" && k !== "no assignment row")
  .reduce((n, [, rows]) => n + rows.length, 0);

console.log(`\nVERDICT: ${
  hiddenByWindow
    ? `CONFIRMED. ${hiddenByWindow} attendance record(s) are hidden from the client purely because work_date falls outside the assignment start/end window. A timesheet submitted for one of those days lands in attendance_records as client_review and is invisible in every client queue, which reads client_attendance_summary. The original P1 finding was correct.`
    : "No records are currently hidden by the assignment window. The filter is in the view regardless; it just has no rows to hide right now."
}`);