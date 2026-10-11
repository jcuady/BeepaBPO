// What does super_admin actually lack, and does it matter?
//
// Section 2 of the QA report records this as a product call: "`super_admin` holds 21 of 50
// permissions - deliberate platform-vs-business split, or a gap". That is not answerable
// without knowing WHICH 29 are missing. A super admin that cannot approve payroll, or
// cannot read client documents, is a very different thing from one that cannot manage the
// platform's own billing settings.
//
// This lists the gaps and scores them by blast radius, so the decision is made on the
// actual set rather than on a ratio.
//
// Usage: node scripts/audit/qa-inspect-super-admin-gaps.mjs

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

const { data: roles, error: rErr } = await db.from("roles").select("id, code, name");
if (rErr) throw new Error(`roles: ${rErr.message}`);
// `permissions` has no `name` column -- it is (code, description). Guessing `name` is how
// this script first died; `types/database.ts` is the authority when a projection fails.
const { data: perms, error: pErr } = await db.from("permissions").select("id, code, description");
if (pErr) throw new Error(`permissions: ${pErr.message}`);
const { data: rp, error: rpErr } = await db.from("role_permissions").select("role_id, permission_id");
if (rpErr) throw new Error(`role_permissions: ${rpErr.message}`);

const byCode = new Map(roles.map((r) => [r.code, r]));
const permById = new Map(perms.map((p) => [p.id, p]));

function holds(roleCode) {
  const role = byCode.get(roleCode);
  if (!role) return new Set();
  const ids = rp.filter((x) => x.role_id === role.id).map((x) => x.permission_id);
  return new Set(ids.map((id) => permById.get(id)).filter(Boolean).map((p) => p.code));
}

const superAdmin = holds("super_admin");
const all = new Set(perms.map((p) => p.code));
const missing = [...all].filter((c) => !superAdmin.has(c)).sort();

console.log(`roles: ${roles.map((r) => r.code).join(", ")}`);
console.log(`permissions: ${all.size}; super_admin holds ${superAdmin.size}\n`);

// Who else holds each missing permission? A permission no role holds is dead config. A
// permission exactly one other role holds is a deliberate specialisation.
const holders = new Map();
for (const code of missing) {
  const who = roles.filter((r) => holds(r.code).has(code)).map((r) => r.code);
  holders.set(code, who);
}

console.log(`\npermissions super_admin DOES hold (${superAdmin.size}):`);
console.log(`  ${[...superAdmin].sort().join("\n  ")}`);

// A gap is only alarming next to what the role *is*. Print it so "21 of 50" can be read
// as a shape rather than a ratio.
console.log("\npermissions super_admin does NOT hold:");
for (const code of missing) {
  const who = holders.get(code);
  const tag = !who.length ? "HELD BY NO ROLE - dead config" : who.length === 1 ? `only ${who[0]}` : who.join(", ");
  console.log(`  ${code.padEnd(34)} ${tag}`);
}

const orphans = missing.filter((c) => holders.get(c).length === 0);
console.log(`\n${orphans.length} permission(s) no role holds at all: ${orphans.join(", ") || "none"}`);

// Which of the gaps are load-bearing? Money, access control and client data are the ones
// where "super admin cannot do this" reads as a defect rather than a boundary.
const moneyish = missing.filter((c) => /(payroll|invoice|billing|payslip|cash_advance)/.test(c));
const accessish = missing.filter((c) => /(manage|admin|rbac|user\.|roles)/.test(c));
const clientData = missing.filter((c) => /(client|document|contract)/.test(c));

console.log(`\nblast radius of the gaps:`);
console.log(`  money / payroll : ${moneyish.length}  ${moneyish.join(", ")}`);
console.log(`  access control  : ${accessish.length}  ${accessish.join(", ")}`);
console.log(`  client data     : ${clientData.length}  ${clientData.join(", ")}`);