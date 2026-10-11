// Is the Supabase auth-email rate limit still blocking the last 3 unexercised actions?
//
// WHY THIS EXISTS
// `signupAction`, `resetPasswordAction` and `inviteClientUser` are the only three of
// 83 server actions that no committed script has driven end to end, and all three are
// blocked by the same thing: each asks Supabase to send an email, and this project
// currently answers HTTP 429 "email rate limit exceeded" for every such request.
// Without this script the way to find out is to start a full server, sign in through
// a browser, fill a form and read the error off the page.
//
// WHAT IT ACTUALLY DOES
// Two probes, one for each API the product calls:
//   - `auth.signUp` on the ANON key -- the exact call `signupAction` makes.
//   - `auth.admin.inviteUserByEmail` on the service-role key -- the call
//     `inviteClientUser` makes.
// Each probe prints the status and message, and DELETES any user it managed to create.
// It never leaves an account behind, so it is safe to re-run as often as you like.
//
// A note on the probe address: the domain matters. Supabase validates the address
// BEFORE it reaches the rate limiter, so a reserved TLD such as `.invalid` comes back
// as 400 "Email address is invalid" -- which proves nothing about the 429 and looks
// superficially like the blocker clearing. These probes use `demo.beepabpo.com`, the
// same domain the existing QA harness signs in with, so the request actually reaches
// the limiter.
//
// Usage: node scripts/audit/check-auth-email-rate-limit.mjs
// Exit 0 = not rate limited (the remaining 3 actions can be driven).
// Exit 1 = still rate limited (HTTP 429).

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

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY);
const pub = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const stamp = Date.now();
const password = "QaProbe!2026x";
let rateLimited = false;

/** Probe one email-sending path and delete anything it managed to create. */
async function probe(label, call) {
  const { userId, error } = await call();
  const status = error?.status ?? "?";
  const message = error?.message ?? "no error";
  console.log(`${label}: ${error ? `HTTP ${status} — ${message}` : "succeeded"}`);
  if (error?.status === 429) rateLimited = true;
  // Leave nothing behind, and say so if we cannot.
  if (userId) {
    const del = await admin.auth.admin.deleteUser(userId);
    console.log(`${label}: created user ${userId} — ${del.error ? `COULD NOT DELETE (${del.error.message})` : "deleted again"}`);
  }
}

await probe("signupAction          (auth.signUp)", async () => {
  const { data, error } = await pub.auth.signUp({
    email: `qa-signup-probe-${stamp}@demo.beepabpo.com`,
    password,
    options: { data: { full_name: "QA Probe" } },
  });
  return { userId: data?.user?.id, error };
});

await probe("inviteClientUser      (admin.inviteUserByEmail)", async () => {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(`qa-invite-probe-${stamp}@demo.beepabpo.com`);
  return { userId: data?.user?.id, error };
});

console.log(
  rateLimited
    ? "\nSTILL RATE LIMITED — the 3 auth-email actions remain unexercised. Re-run later; no cleanup is owed."
    : "\nNOT RATE LIMITED — the 3 auth-email actions can be driven end to end now.",
);
process.exitCode = rateLimited ? 1 : 0;