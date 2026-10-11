// Delete throwaway auth accounts left by an aborted QA run.
//
// WHY THIS EXISTS. The first version of `qa-exercise-reset-password.mjs` derived the user id
// from a helper call that threw, so `userId` was still null when cleanup ran and the account
// survived -- the same shape as the recruitment fixture leak, in a different table. The fix
// in the exercise is to assign the id the moment the API returns it; this script is the mop
// for anything an older or interrupted run left behind.
//
// SCOPE. Only addresses matching `qa-reset-*`, a prefix this harness invents. Demo accounts
// are `*@demo.beepabpo.com` with human names and never carry it. Memberships and profiles
// for the deleted ids are removed too, in case a signup trigger created any.
//
// Usage: node scripts/audit/qa-cleanup-qa-accounts.mjs [--dry-run]

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

const DRY_RUN = process.argv.includes("--dry-run");
const PREFIX = "qa-reset-";
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Wrapped in `main()` because the first version called `process.exit(0)` on the
// "nothing to clean" path -- and that is precisely what produces
//   Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76
// It reproduced here even with no browser involved, which is the proof that the crash is an
// unhandled path racing handle teardown rather than anything to do with `process.exit` being
// "the old cause". Returning normally lets the process drain its handles.
async function main() {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`listUsers: ${error.message}`);

  const victims = data.users.filter((u) => (u.email ?? "").startsWith(PREFIX));
  console.log(`auth users: ${data.users.length}   matching ${PREFIX}*: ${victims.length}`);
  for (const v of victims) console.log(`  WILL DELETE ${v.email}  ${v.id}  (${v.user_metadata?.full_name ?? "no name"})`);

  if (victims.length === 0) {
    console.log("nothing to clean");
    return;
  }
  if (DRY_RUN) {
    console.log("\n--dry-run: nothing deleted");
    return;
  }

  for (const v of victims) {
    await db.from("organization_memberships").delete().eq("user_id", v.id);
    await db.from("profiles").delete().eq("id", v.id);
    const { error: delErr } = await db.auth.admin.deleteUser(v.id);
    console.log(`  deleted ${v.email}${delErr ? `  FAILED ${delErr.message}` : ""}`);
  }

  const after = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (after.error) throw new Error(`listUsers after: ${after.error.message}`);
  const remaining = after.data.users.filter((u) => (u.email ?? "").startsWith(PREFIX));
  const profilesLeft = await db.from("profiles").select("id").in("id", victims.map((v) => v.id));

  console.log(`\nauth users ${data.users.length} -> ${after.data.users.length}`);
  console.log(`matching ${PREFIX}* remaining: ${remaining.length}`);
  console.log(`profiles left for deleted ids: ${profilesLeft.data?.length ?? 0}`);

  const ok = remaining.length === 0 && after.data.users.length === data.users.length - victims.length && (profilesLeft.data?.length ?? 0) === 0;
  console.log(ok ? "\nOK  throwaway accounts cleared" : "\nFAIL  accounts did not settle as expected");
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exitCode = 1;
});