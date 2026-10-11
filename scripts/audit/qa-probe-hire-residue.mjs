// What did the last (partially-failed) hire run leave behind?
//
// `restore()` threw on a stale identifier partway through, so the verification that was
// supposed to prove the database was untouched never ran. This reads the same facts
// independently, so the claim "the previous run cleaned up" is checked rather than assumed.
//
// Read-only.
//
// Usage: node scripts/audit/qa-probe-hire-residue.mjs

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
const must = async (p, what) => {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
};

const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
const demoUser = users?.users.find((u) => u.email === "applicant@demo.beepabpo.com");
console.log(`demo auth user: ${demoUser?.id ?? "MISSING"}`);

const profile = await must(
  db.from("profiles").select("first_name, last_name, display_name, status").eq("id", demoUser.id).maybeSingle(),
  "profile",
);
console.log(`profile: "${profile?.display_name}" first=${profile?.first_name} last=${profile?.last_name} status=${profile?.status}`);
console.log(`  expected display_name "Demo Applicant" (unchanged by a hire+restore cycle)`);

const memberships = await must(
  db.from("organization_memberships").select("id, membership_type, status").eq("user_id", demoUser.id),
  "memberships",
);
for (const m of memberships) {
  const roles = await must(
    db.from("membership_roles").select("roles!inner(code)").eq("membership_id", m.id), "roles",
  );
  console.log(`membership ${m.id}: type=${m.membership_type} status=${m.status} roles=[${roles.map((r) => r.roles.code).join(",")}]`);
  console.log(`  expected type=applicant status=active roles=[applicant]`);
}

const emps = await must(db.from("employees").select("id, profile_id, employee_number").eq("profile_id", demoUser.id), "employees");
console.log(`employees for this profile: ${emps.length} ${emps.length ? JSON.stringify(emps) : "(expected 0 - the hire created one and cleanup should have removed it)"}`);

const fixtures = await must(db.from("applicants").select("id, email, source"), "applicants");
console.log(`fixture applicants remaining: ${fixtures.filter((a) => a.source === "qa_hire_fixture").length} (expected 0)`);

const apps = await must(db.from("job_applications").select("id, stage"), "apps");
console.log(`job_applications: ${apps.length}`);

// Dangling audit rows: the fixture application was deleted, but its hire_convert audit row
// may have survived the aborted cleanup. Find audit rows whose entity_id matches no live
// job_application.
const audit = await must(
  db.from("audit_logs").select("id, action, entity_type, entity_id, created_at").eq("entity_type", "job_application"),
  "audit",
);
const liveIds = new Set(apps.map((a) => a.id));
const dangling = audit.filter((a) => !liveIds.has(a.entity_id));
console.log(`\naudit rows for job_application: ${audit.length}`);
console.log(`  dangling (entity_id no longer exists): ${dangling.length}`);
for (const d of dangling) {
  console.log(`    ${d.action}  entity_id=${d.entity_id}  at ${d.created_at}`);
}

// VERDICT. `applicant.stage_change` with a null entity_id predates this harness's shape and
// is left alone; what this harness creates is `application.stage_update` and
// `application.hire_convert`, and any of those pointing at a deleted application is residue
// this exercise should have cleaned up. Exiting non-zero makes the probe usable as a gate
// rather than something a human has to eyeball.
const harnessResidue = dangling.filter(
  (d) => d.action === "application.stage_update" || d.action === "application.hire_convert",
);
const legacy = dangling.filter((d) => !harnessResidue.includes(d));
console.log(`\nharness residue (application.*): ${harnessResidue.length}`);
console.log(`legacy rows left alone: ${legacy.length}${legacy.length ? ` (${[...new Set(legacy.map((l) => l.action))].join(", ")})` : ""}`);

const employeesClean = emps.length === 0;
const fixturesClean = fixtures.filter((a) => a.source === "qa_hire_fixture").length === 0;
console.log(`\nemployees cleaned: ${employeesClean}   fixture applicants cleaned: ${fixturesClean}`);

const ok = harnessResidue.length === 0 && employeesClean && fixturesClean;
console.log(ok ? "\nOK  the hire exercise left no residue" : `\nFAIL  ${harnessResidue.length} dangling application audit row(s) survived`);
if (!ok) process.exitCode = 1;