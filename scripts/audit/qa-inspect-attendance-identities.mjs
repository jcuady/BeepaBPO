// Map the identities the attendance exercise needs: which auth user owns which
// employee record, and which client org each client user belongs to.
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

const { data: authData, error: eA } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
if (eA) throw new Error(`auth users: ${eA.message}`);
const authUsers = authData.users;
const byEmail = new Map(authUsers.map((u) => [u.email, u.id]));

// `employees` links to an auth user through `profile_id` (see
// lib/employees/resolve.ts), and spells the code `employee_number`. Guessing
// either name returns `data: null` with an error and looks like "no employees".
const { data: emps, error: eE } = await db
  .from("employees")
  .select("id, profile_id, employee_number, default_timezone, employment_status, job_title");
if (eE) throw new Error(`employees: ${eE.message}`);
const empByUser = new Map(emps.filter((e) => e.profile_id).map((e) => [e.profile_id, e]));

console.log("--- internal demo users -> employee record ---");
for (const u of authUsers) {
  const emp = empByUser.get(u.id);
  if (!emp) continue;
  const m = u.email.split("@")[0];
  console.log(`  ${u.email.padEnd(34)} emp=${emp.id.slice(0, 8)} code=${emp.employee_number ?? "-"} tz=${emp.default_timezone ?? "-"} status=${emp.employment_status ?? "-"}`);
}

console.log("\n--- client users -> client organization ---");
const { data: memberships, error: eM } = await db
  .from("organization_memberships")
  .select("user_id, organization_id, membership_type, status, is_primary");
if (eM) throw new Error(`memberships: ${eM.message}`);
const { data: orgs, error: eO } = await db.from("organizations").select("id, name, type");
if (eO) throw new Error(`orgs: ${eO.message}`);
const orgName = new Map(orgs.map((o) => [o.id, `${o.name} (${o.type})`]));

const seen = new Set();
for (const m of memberships) {
  if (m.membership_type !== "client") continue;
  const email = authUsers.find((u) => u.id === m.user_id)?.email ?? m.user_id.slice(0, 8);
  const key = `${email}|${m.organization_id}`;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`  ${String(email).padEnd(34)} org=${orgName.get(m.organization_id) ?? m.organization_id.slice(0, 8)} status=${m.status}`);
}

console.log("\n--- employees with an active client assignment ---");
const { data: assigns, error: eAs } = await db
  .from("employee_assignments")
  .select("employee_id, client_organization_id, status")
  .eq("assignment_type", "client").eq("status", "active");
if (eAs) throw new Error(`assignments: ${eAs.message}`);
for (const a of assigns ?? []) {
  const emp = emps.find((e) => e.id === a.employee_id);
  const owner = emp?.profile_id ? authUsers.find((u) => u.id === emp.profile_id)?.email : "(no user)";
  console.log(`  emp=${a.employee_id.slice(0, 8)} user=${owner} client_org=${orgName.get(a.client_organization_id) ?? a.client_organization_id.slice(0, 8)}`);
}

console.log("\n--- attendance_records today ---");
const today = new Date().toISOString().slice(0, 10);
const { data: todayRows, error: eT } = await db
  .from("attendance_records").select("id, employee_id, work_date, status, approval_status").eq("work_date", today);
if (eT) throw new Error(`today rows: ${eT.message}`);
console.log(`  ${today}: ${(todayRows ?? []).length} row(s)`);
for (const r of todayRows ?? []) {
  const emp = emps.find((e) => e.id === r.employee_id);
  const owner = emp?.user_id ? authUsers.find((u) => u.id === emp.user_id)?.email : "(no user)";
  console.log(`    id=${r.id.slice(0, 8)} emp=${r.employee_id.slice(0, 8)} user=${owner} ${r.status}/${r.approval_status}`);
}
void byEmail;