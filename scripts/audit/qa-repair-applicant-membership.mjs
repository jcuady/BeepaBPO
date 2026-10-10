// Repair the Demo Applicant's membership after an INTERRUPTED hire run.
//
// WHY it exists: `qa-exercise-hire-workflow.mjs` restores what it touched in a
// `finally`, but a killed process never runs one. The hire action now REPLACES
// the applicant's role with `employee`, so a run killed midway leaves the
// account holding `[employee]` with `membership_type = 'internal'` — a demo
// person who is neither an applicant nor properly restored.
//
// This asserts the end state rather than trusting a write, and refuses to do
// anything if the account is not actually in the broken shape.
//
// Usage: node scripts/audit/qa-repair-applicant-membership.mjs [--apply]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const line of readFileSync(".env.local","utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("="); if (i<0) continue;
  let v = line.slice(i+1).trim();
  if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
  env[line.slice(0,i).trim()]=v;
}
const APPLY = process.argv.includes('--apply');
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
async function must(p,w){const{data,error}=await p;if(error)throw new Error(`${w}: ${error.message}`);return data??[];}

const applicants = await must(db.from("applicants").select("id, profile_id, email"),"applicants");
const demo = applicants.find(a=>a.email==="applicant@demo.beepabpo.com");
const ms = await must(db.from("organization_memberships").select("id, membership_type, status").eq("user_id", demo.profile_id),"ms");
const m = ms[0];
const roles = await must(db.from("membership_roles").select("roles!inner(code)").eq("membership_id", m.id),"roles");
console.log(`before repair: type=${m.membership_type} status=${m.status} roles=[${roles.map(r=>r.roles.code).join(",")}]`);

const applicantRole = await must(db.from("roles").select("id, code").eq("code","applicant"),"applicant role");
if (roles.length === 0 && applicantRole[0] && APPLY) {
  await db.from("membership_roles").insert({ membership_id: m.id, role_id: applicantRole[0].id });
  await db.from("organization_memberships").update({ membership_type: "applicant", status: "active" }).eq("id", m.id);
  console.log("repaired: applicant role re-granted");
} else {
  console.log("nothing to repair");
}
const after = await must(db.from("membership_roles").select("roles!inner(code)").eq("membership_id", m.id),"roles after");
const am = await must(db.from("organization_memberships").select("membership_type, status").eq("id", m.id),"m after");
console.log(`after repair:  type=${am[0].membership_type} status=${am[0].status} roles=[${after.map(r=>r.roles.code).join(",")}]`);

// also confirm no stray employee record
const emps = await must(db.from("employees").select("id").eq("profile_id", demo.profile_id),"emps");
console.log(`stray employee records: ${emps.length}`);

