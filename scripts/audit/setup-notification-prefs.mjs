// Setup notification preferences for every auth user.
// - in_app_enabled: true (every user gets in-app notifications)
// - push_enabled: true (so push works once they subscribe)
// - email_enabled: based on role (HR/Finance/Owner get email digests; everyone else opts in manually)
// - category_preferences: per-type opt-in (default empty = accept all)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx < 0) continue;
  let v = line.slice(idx + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, idx).trim()] = v;
}
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_SECRET_KEY = "[redacted]";
process.env.SUPABASE_SERVICE_ROLE_KEY = "[redacted]";
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// Roles that should get email digests out of the box (people who own approvals/finance/HR).
const EMAIL_ROLES = ["owner", "super_admin", "hr", "finance", "operations", "team_lead"];

async function main() {
  console.log("=== Setting notification_preferences for every demo user ===\n");

  // Pull every auth user
  const { data: users, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 50 });
  if (error) { console.error("listUsers failed:", error.message); return; }
  const allUsers = users?.users ?? [];
  console.log(`Found ${allUsers.length} auth users`);

  // Pull memberships to get roles
  const { data: mems } = await sb
    .from("organization_memberships")
    .select("user_id, roles(code), organization:organizations(type)")
    .eq("status", "active");
  const rolesByUser = new Map();
  for (const m of mems ?? []) {
    const codes = (m.roles ?? []).map((r) => r?.code).filter(Boolean);
    rolesByUser.set(m.user_id, codes);
  }

  let created = 0, updated = 0, skipped = 0;
  for (const u of allUsers) {
    const roles = rolesByUser.get(u.id) ?? [];
    const wantsEmail = roles.some((r) => EMAIL_ROLES.includes(r));

    // Existing prefs
    const { data: existing } = await sb
      .from("notification_preferences")
      .select("user_id, in_app_enabled, push_enabled, email_enabled, category_preferences")
      .eq("user_id", u.id)
      .maybeSingle();

    const desired = {
      user_id: u.id,
      in_app_enabled: true,
      push_enabled: existing?.push_enabled ?? true,
      email_enabled: existing?.email_enabled ?? wantsEmail,
      category_preferences: existing?.category_preferences ?? {},
    };

    if (existing) {
      // only update if values differ
      const differs =
        existing.in_app_enabled !== desired.in_app_enabled ||
        existing.email_enabled !== desired.email_enabled;
      if (!differs) { skipped++; continue; }
      const { error: upErr } = await sb
        .from("notification_preferences")
        .update({ in_app_enabled: true, email_enabled: desired.email_enabled })
        .eq("user_id", u.id);
      if (upErr) { console.error(`  [FAIL] ${u.email}:`, upErr.message); continue; }
      updated++;
      console.log(`  [UPD]  ${u.email.padEnd(40)} email=${desired.email_enabled}`);
    } else {
      const { error: insErr } = await sb.from("notification_preferences").insert(desired);
      if (insErr) { console.error(`  [FAIL] ${u.email}:`, insErr.message); continue; }
      created++;
      console.log(`  [INS]  ${u.email.padEnd(40)} email=${desired.email_enabled} push=${desired.push_enabled}`);
    }
  }
  console.log(`\nTotals: ${created} created, ${updated} updated, ${skipped} unchanged`);
}

main().catch((e) => { console.error("FATAL", e.message); process.exit(1); });