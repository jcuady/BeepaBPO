// Are there memberships pointing at auth users who have no profile?
//
// Found while unblocking the hire workflow: `applicant@demo.beepabpo.com` has an
// `applicant/active` membership in `organization_memberships` and NO row in `profiles`.
// Anything that renders a person by name -- an approver list, a ticket assignee, a
// timesheet row -- reads `profiles`, so a membership without one is a user who exists,
// can sign in, and is invisible to everything that displays people.
//
// Whether that is one bad seed row or a systemic gap depends on whether profiles are
// supposed to be created by a trigger. This checks the whole table rather than the one row,
// and says which of the two it is.
//
// Read-only.
//
// Usage: node scripts/audit/qa-probe-orphan-memberships.mjs

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

const { data: memberships, error: mErr } = await admin
  .from("organization_memberships")
  .select("id, user_id, membership_type, status, created_at")
  .order("created_at", { ascending: true });
if (mErr) throw new Error(`memberships: ${mErr.message}`);

const { data: profiles, error: pErr } = await admin
  .from("profiles").select("id, display_name");
if (pErr) throw new Error(`profiles: ${pErr.message}`);

const profileIds = new Set((profiles ?? []).map((p) => p.id));
const orphans = memberships.filter((m) => !profileIds.has(m.user_id));

console.log(`memberships: ${memberships.length}   profiles: ${profiles.length}`);
console.log(`memberships whose user has NO profile: ${orphans.length}\n`);

// Name the orphans by auth email, because "user_id has no profile" is not actionable on its own.
const { data: page1, error: uErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
if (uErr) throw new Error(`listUsers: ${uErr.message}`);
const emailById = new Map(page1.users.map((u) => [u.id, u.email]));

for (const m of orphans) {
  console.log(
    `  ${String(m.membership_type).padEnd(11)} ${String(m.status).padEnd(8)} user=${m.user_id.slice(0, 8)}  ${emailById.get(m.user_id) ?? "(no auth user either)"}  created ${m.created_at}`,
  );
}

// Reverse direction: profiles with no membership at all. Less harmful -- a profile row can
// legitimately exist for someone who has not joined an org yet -- but worth seeing.
const memberIds = new Set(memberships.map((m) => m.user_id));
const orphanProfiles = (profiles ?? []).filter((p) => !memberIds.has(p.id));
console.log(`\nprofiles with NO membership: ${orphanProfiles.length}`);
for (const p of orphanProfiles.slice(0, 10)) {
  console.log(`  ${p.display_name ?? "(no display_name)"}  ${p.id.slice(0, 8)}  ${emailById.get(p.id) ?? ""}`);
}

console.log(`\nVERDICT: ${
  orphans.length === 0
    ? "no orphaned memberships -- every member has a profile"
    : `${orphans.length} membership(s) reference a user with no profile. Anyone rendering these people by name gets nothing back, and any join-on-display query silently omits them. Whether profiles should exist is a schema question: if a trigger creates them, these rows were inserted past it; if not, profile creation is a caller's responsibility and at least one caller has not done it.`
}`);