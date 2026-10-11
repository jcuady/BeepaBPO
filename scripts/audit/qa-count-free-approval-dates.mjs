// How many free, in-window attendance dates exist per client org?
//
// The approvals pager probe needs more than PAGE_SIZE (20) pending days to prove that
// pagination happens. One employee had only 17 free days left inside the assignment
// window, which is not enough, so this prints the pool per client org before the probe
// picks its fixture size.
//
// Usage: node scripts/audit/qa-count-free-approval-dates.mjs

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

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const today = new Date().toISOString().slice(0, 10);

const { data: assignments, error } = await db
  .from("employee_assignments")
  .select("employee_id, client_organization_id, start_date, end_date")
  .eq("assignment_type", "client")
  .eq("status", "active")
  .not("client_organization_id", "is", null);
if (error) throw new Error(`assignments: ${error.message}`);

const pools = new Map();
for (const a of assignments) {
  const key = a.client_organization_id;
  if (!pools.has(key)) pools.set(key, []);
  pools.get(key).push(a);
}

for (const [orgId, list] of pools) {
  const { data: existing } = await db
    .from("attendance_records").select("work_date")
    .in("employee_id", list.map((a) => a.employee_id));
  const taken = new Set((existing ?? []).map((r) => r.work_date));
  let free = 0;
  const perEmployee = [];
  for (const a of list) {
    const startMs = new Date(`${a.start_date ?? "1970-01-01"}T00:00:00Z`).getTime();
    const endMs = a.end_date ? new Date(`${a.end_date}T00:00:00Z`).getTime() : new Date(`${today}T00:00:00Z`).getTime();
    let n = 0;
    for (let ms = endMs; ms >= startMs; ms -= 86400000) {
      const d = new Date(ms).toISOString().slice(0, 10);
      if (d <= today && !taken.has(d)) n++;
    }
    perEmployee.push(`${a.employee_id.slice(0, 8)}:${n}`);
    free += n;
  }
  console.log(`org ${orgId.slice(0, 8)}  employees=[${perEmployee.join(" ")}]  free in-window dates=${free}`);
}