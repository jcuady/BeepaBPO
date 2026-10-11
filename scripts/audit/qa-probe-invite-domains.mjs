// Is `admin.inviteUserByEmail` blocked for EVERY address, or only some domains?
//
// WHY. `check-auth-email-rate-limit.mjs` probes one address, `qa-invite-probe-…@demo.beepabpo.com`,
// and it answers 429. But that same script shows the limit is NOT uniform: `auth.signUp` is
// ACCEPTED on the apex domain and rate limited on the demo subdomain, and
// `resetPasswordForEmail` is accepted outright. So "invites are blocked" was never
// established -- only "an invite to THIS address was blocked".
//
// `inviteClientUser` takes whatever address the operator types. If an apex-domain invite
// succeeds, the action can be driven through the real UI after all, and the only thing
// standing at 82/83 is an artefact of which address the probe happened to use.
//
// SAFETY. Every invite this script gets accepted CREATES a user. Each is deleted immediately,
// and the deletion is verified. Nothing survives a run.
//
// Usage: node scripts/audit/qa-probe-invite-domains.mjs

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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const stamp = Date.now().toString().slice(-8);

// Domains to try. `demo.beepabpo.com` is the one every prior probe used; the rest test
// whether the block is domain-scoped or global.
const DOMAINS = [
  "demo.beepabpo.com",
  "beepabpo.com",
  "gmail.com",
];

const created = [];
let anyAccepted = false;

for (const domain of DOMAINS) {
  const email = `qa-invite-${stamp}@${domain}`;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  if (error) {
    console.log(`BLOCKED  ${email.padEnd(38)}  ${error.message}`);
  } else {
    anyAccepted = true;
    const id = data?.user?.id;
    created.push({ email, id });
    console.log(`ACCEPTED ${email.padEnd(38)}  user=${id}`);
  }
}

console.log(`\ncreated by this probe: ${created.length}`);
for (const c of created) {
  const { error } = await admin.auth.admin.deleteUser(c.id);
  console.log(`  delete ${c.email}  ${error ? `FAILED ${error.message}` : "ok"}`);
  // Verify, rather than trust the delete call.
  const after = await admin.auth.admin.getUserById(c.id).catch(() => ({ data: null, error: null }));
  console.log(`  verified gone: ${!after.data?.user}`);
}

const remaining = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const leaked = (remaining.data?.users ?? []).filter((u) => (u.email ?? "").startsWith(`qa-invite-${stamp}`));
console.log(`\nqa-invite-${stamp}* remaining: ${leaked.length}`);

if (leaked.length > 0) {
  console.log("LEAK: probe created an account it did not delete");
  process.exitCode = 1;
} else {
  console.log(
    anyAccepted
      ? "\nVERDICT: inviteUserByEmail works for at least one domain -- inviteClientUser is drivable through the UI."
      : "\nVERDICT: inviteUserByEmail is blocked for every domain tried. The block is global, not address-scoped.",
  );
}