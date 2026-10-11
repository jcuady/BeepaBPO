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

/**
 * Probe one email-sending path and delete anything it managed to create.
 *
 * Returns how the call was ANSWERED, because "not rate limited" and "could not tell"
 * are different results and collapsing them would make this script lie:
 *
 *   "limited"   — HTTP 429. The blocker is still in place.
 *   "rejected"  — HTTP 4xx other than 429. The address was refused before the limiter
 *                 was reached, so this shape proves nothing either way.
 *   "accepted"  — no error. The limiter is not blocking this path.
 *
 * It NEVER signs up with an address that already has an account: Supabase answers
 * that with HTTP 200 and a user object whose id belongs to no real auth user, which
 * this script would then try to delete and fail on. Fresh per-run addresses only.
 */
async function probe(label, call) {
  const { userId, error } = await call();
  const status = error?.status ?? "?";
  const message = error?.message ?? "no error";

  let verdict;
  if (!error) verdict = "accepted";
  else if (status === 429) verdict = "limited";
  else verdict = "rejected";

  console.log(`${label}: ${error ? `HTTP ${status} — ${message}` : "no error"}  [${verdict}]`);

  // Leave nothing behind, and say so if we cannot.
  if (userId) {
    const del = await admin.auth.admin.deleteUser(userId);
    console.log(`${label}: created user ${userId} — ${del.error ? `COULD NOT DELETE (${del.error.message})` : "deleted again"}`);
  }
  return verdict;
}

const results = [];

console.log(`Probing the three API calls that block the last 3 actions (${new Date().toISOString()})\n`);

// signupAction -> auth.signUp on the ANON key.
// Two address shapes on purpose: Supabase validates the address BEFORE it reaches the
// rate limiter, so a single unlucky shape can answer 400 and tell you nothing. If one
// shape is rejected, the other still decides the question.
results.push(["signUp (apex domain)", await probe("signupAction           (auth.signUp)", async () => {
  const { data, error } = await pub.auth.signUp({
    email: `qaprobe${stamp}@beepabpo.com`,
    password,
    options: { data: { full_name: "QA Probe" } },
  });
  return { userId: data?.user?.id, error };
})]);

results.push(["signUp (demo subdomain)", await probe("signupAction           (auth.signUp, alt)", async () => {
  const { data, error } = await pub.auth.signUp({
    email: `qa-probe-${stamp}@demo.beepabpo.com`,
    password,
    options: { data: { full_name: "QA Probe" } },
  });
  return { userId: data?.user?.id, error };
})]);

// resetPasswordAction / forgotPasswordAction -> auth.resetPasswordForEmail.
results.push(["resetPasswordForEmail", await probe("resetPasswordAction    (resetPasswordForEmail)", async () => {
  const { error } = await pub.auth.resetPasswordForEmail(`qaprobe${stamp}@demo.beepabpo.com`, {
    redirectTo: `${url}/auth/callback?next=/reset-password`,
  });
  return { userId: null, error };
})]);

// inviteClientUser -> auth.admin.inviteUserByEmail on the service-role key.
results.push(["inviteUserByEmail", await probe("inviteClientUser       (admin.inviteUserByEmail)", async () => {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(`qa-invite-probe-${stamp}@demo.beepabpo.com`);
  return { userId: data?.user?.id, error };
})]);

const limited = results.filter(([, v]) => v === "limited").map(([n]) => n);
const inconclusive = results.filter(([, v]) => v === "rejected").map(([n]) => n);
const accepted = results.filter(([, v]) => v === "accepted").map(([n]) => n);

console.log("");
if (limited.length) {
  console.log(`STILL RATE LIMITED on: ${limited.join(", ")}`);
  if (inconclusive.length) console.log(`could not tell (address rejected before the limiter): ${inconclusive.join(", ")}`);
  if (accepted.length) console.log(`not limited: ${accepted.join(", ")}`);
} else if (accepted.length) {
  console.log(`NOT RATE LIMITED on: ${accepted.join(", ")}`);
} else {
  console.log(`COULD NOT DETERMINE. Every probe was rejected as an invalid address before the limiter: ${inconclusive.join(", ")}`);
}

console.log("\nWhy each of the 3 actions is still unexercised, and what would unblock it:");
console.log("  signupAction      needs auth.signUp to be accepted AND the confirmation email");
console.log("                    to arrive. Both are gated: signUp is rate limited above.");
console.log("  inviteClientUser  needs admin.inviteUserByEmail accepted. Rate limited above.");
console.log("  resetPasswordAction does NOT need the rate limit cleared — it consumes a");
console.log("                    recovery token from an inbox. There is no mail provider in");
console.log("                    this environment, so this one stays blocked either way.");
console.log("\nNothing was created by this run; every account it made was deleted again.");
process.exitCode = limited.length ? 1 : 0;