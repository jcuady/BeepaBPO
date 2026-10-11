// One-off cleanup: remove the residue left by a crashed qa-exercise-client-invite run.
//
// The exercise's cleanup selected `id` from `membership_roles`, a column that
// does not exist. `must()` correctly threw, so NONE of the four deletes ran and
// the invited user, its profile, its membership and its role row were all left
// behind in the live database.
//
// Scoped to one user id. Prints what it removed and verifies afterwards.

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

const USER_ID = process.argv[2];
if (!USER_ID) {
  console.error("usage: node cleanup-invite-residue.mjs <auth-user-id>");
  process.exit(2);
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// 1. memberships for this user
const { data: memberships, error: memErr } = await db
  .from("organization_memberships")
  .select("id")
  .eq("user_id", USER_ID);
if (memErr) { console.error("could not read memberships:", memErr.message); process.exit(1); }
console.log(`memberships found: ${memberships.length}`);

// 2. membership_roles BY MEMBERSHIP_ID -- membership_roles has no `id` column,
//    which is the mistake that left this residue in the first place.
for (const m of memberships) {
  const delRoles = await db.from("membership_roles").delete().eq("membership_id", m.id);
  console.log(`membership_roles for ${m.id}: ${delRoles.error ? "ERR " + delRoles.error.message : "deleted"}`);
}
const delMems = await db.from("organization_memberships").delete().eq("user_id", USER_ID);
console.log(`memberships: ${delMems.error ? "ERR " + delMems.error.message : "deleted"}`);

// 3. profile
const delProfile = await db.from("profiles").delete().eq("id", USER_ID);
console.log(`profile: ${delProfile.error ? "ERR " + delProfile.error.message : "deleted"}`);

// 4. auth user
const delUser = await db.auth.admin.deleteUser(USER_ID);
console.log(`auth_user: ${delUser.error ? "ERR " + delUser.error.message : "deleted"}`);

// ---- verify by reading back, not by trusting the deletes ---------------------
const v1 = await db.from("organization_memberships").select("id").eq("user_id", USER_ID);
const v2 = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
const ghost = v2.data?.users?.find((u) => u.id === USER_ID);
const v3 = await db.from("profiles").select("id").eq("id", USER_ID);

console.log("");
console.log(`verify memberships: ${v1.error ? "ERR " + v1.error.message : v1.data.length + " row(s)"}`);
console.log(`verify profile:     ${v3.error ? "ERR " + v3.error.message : v3.data.length + " row(s)"}`);
console.log(`verify auth user:   ${ghost ? "STILL PRESENT" : "gone"}`);