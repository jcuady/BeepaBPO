// Who can actually reach lib/cms? Every action requires cms.manage, and earlier
// findings record that `owner` does NOT hold it. If no demo account can manage
// CMS, the whole module is unreachable in practice.
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

const BEEPA = "11111111-1111-1111-1111-111111111111";
const { data: perms, error: e1 } = await db.from("permissions").select("id, code");
if (e1) throw new Error(e1.message);
const cms = (perms ?? []).filter((p) => p.code.startsWith("cms."));
console.log(`cms.* permissions defined: ${cms.length}`);
for (const p of cms) console.log(`  ${p.code}`);

const { data: rolePerms, error: e2 } = await db.from("role_permissions").select("role_id, permission_id");
if (e2) throw new Error(e2.message);

const { data: roles, error: e3 } = await db.from("roles").select("id, code, name");
if (e3) throw new Error(e3.message);
const roleById = new Map((roles ?? []).map((r) => [r.id, r]));
const permCode = new Map((perms ?? []).map((p) => [p.id, p.code]));

console.log("\nroles holding each cms permission:");
for (const p of cms) {
  const holders = (rolePerms ?? [])
    .filter((rp) => rp.permission_id === p.id)
    .map((rp) => roleById.get(rp.role_id)?.code)
    .filter(Boolean);
  console.log(`  ${p.code.padEnd(16)} <- ${holders.join(", ") || "(NOBODY)"}`);
}

// Which demo users hold a role with cms.manage?
const { data: memberships, error: e4 } = await db
  .from("organization_memberships")
  .select("id, user_id, organization_id, membership_type, status")
  .eq("organization_id", BEEPA);
if (e4) throw new Error(e4.message);
const { data: membershipRoles, error: e5 } = await db.from("membership_roles").select("membership_id, role_id");
if (e5) throw new Error(e5.message);
const { data: authData, error: e6 } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
if (e6) throw new Error(e6.message);

console.log("\ndemo users -> cms.manage?");
const mgrPermIds = new Set(cms.map((p) => p.id));
for (const m of memberships ?? []) {
  if (m.status !== "active") continue;
  const email = authData.users.find((u) => u.id === m.user_id)?.email ?? m.user_id.slice(0, 8);
  const mrIds = (membershipRoles ?? []).filter((x) => x.membership_id === m.id).map((x) => x.role_id);
  const roleCodes = mrIds.map((id) => roleById.get(id)?.code).filter(Boolean);
  const hasCms = mrIds.some((rid) =>
    (rolePerms ?? []).some((rp) => rp.role_id === rid && mgrPermIds.has(rp.permission_id)),
  );
  console.log(`  ${String(email).padEnd(34)} roles=[${roleCodes.join(",")}]  cms.manage=${hasCms ? "YES" : "no"}`);
}

// Content inventory, so the exercise knows what already exists.
console.log("\nexisting CMS content by table:");
for (const t of ["blog_posts", "services", "faqs", "industries", "testimonials", "case_studies", "site_settings"]) {
  const { count, error } = await db.from(t).select("id", { count: "exact", head: true });
  console.log(`  ${t.padEnd(16)} ${error ? `ERR ${error.message}` : count}`);
}
const { data: statuses } = await db.from("blog_posts").select("status");
const g = {};
for (const s of statuses ?? []) g[s.status] = (g[s.status] ?? 0) + 1;
console.log(`  blog_posts by status: ${JSON.stringify(g)}`);