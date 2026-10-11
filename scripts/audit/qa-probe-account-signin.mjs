// Ad-hoc: is one demo account actually able to sign in?
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

const email = process.argv[2] ?? "operations@demo.beepabpo.com";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const u = listed.data?.users?.find((x) => x.email === email);
console.log("auth user found:", !!u);
if (u) {
  console.log("  id:            ", u.id);
  console.log("  confirmed_at:  ", u.confirmed_at);
  console.log("  last_sign_in_at:", u.last_sign_in_at);
  console.log("  banned:        ", u.banned);
  console.log("  created_at:    ", u.created_at);
}

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const s = await anon.auth.signInWithPassword({ email, password: env.DEMO_PASSWORD });
console.log("password sign-in:", s.error ? `FAILED — ${s.error.message} (status ${s.error.status})` : "ok");

// Does the app's own resolveWorkspace accept the account? A user can have a
// valid password and still be signed out of the app by a missing or inactive
// membership — `resolveWorkspace` filters `status = 'active'`, so an inactive
// row signs a valid password straight back out to /login.
if (!s.error) {
  const uid = s.data.user.id;
  const { data: mem, error: mErr } = await admin
    .from("organization_memberships")
    .select("id, organization_id, status")
    .eq("user_id", uid);
  console.log("memberships:", mErr ? `ERROR ${mErr.message}` : JSON.stringify(mem));
}