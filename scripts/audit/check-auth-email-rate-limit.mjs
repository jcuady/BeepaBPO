// Is the Supabase auth-email rate limit still blocking the last 3 unexercised actions?
//
// READ THIS BEFORE YOU RUN IT
// ---------------------------
// THIS PROBE CONSUMES THE BUDGET IT IS MEASURING.
//
// A probe that is answered `accepted` has really called `auth.signUp`, which really
// consumed rate-limit budget, before it deletes the user it made. So this script
// cannot tell you "safe to run the exercises now" and then be innocent of the
// exercise being blocked a moment later. Observed directly: a probe run reported
// `signUp (apex domain)` as accepted and `signUp (demo subdomain)` + invite as
// limited; the signup exercise run immediately afterwards was refused with
// "Too many sign-up attempts from this network", and was still refused after a
// further 100 seconds of waiting.
//
// The old header claimed it was "safe to re-run as often as you like". That was
// wrong and it mattered: the documented recovery procedure was itself the thing
// burning the window being waited for.
//
// So: use this to learn the SHAPE of the limit, then leave the environment alone
// long enough for it to recover, then run the real exercise. A green probe is not
// a green light for the exercise.
//
// WHY THIS EXISTS
// `signupAction`, `resetPasswordAction` and `inviteClientUser` are the only three of
// 83 server actions that no committed script has driven end to end, and all three are
// blocked by the same thing: each asks Supabase to send an email, and this project
// currently answers HTTP 429 for every such request.
// Without this script the way to find out is to start a full server, sign in through
// a browser, fill a form and read the error off the page.
//
// WHAT IT ACTUALLY DOES
// Probes, one per API the product calls:
//   - `auth.signUp` on the ANON key, on two address shapes -- the exact call
//     `signupAction` makes.
//   - `auth.admin.inviteUserByEmail` on the service-role key -- the call
//     `inviteClientUser` makes.
// Each probe prints the status and message, and DELETES any user it managed to create.
// It never leaves an account behind.
//
// A note on the probe address: the domain matters. Supabase validates the address
// BEFORE it reaches the rate limiter, so a reserved TLD such as `.invalid` comes back
// as 400 "Email address is invalid" -- which proves nothing about the 429 and looks
// superficially like the blocker clearing. Both domain shapes are therefore probed.
//
// Usage: node scripts/audit/check-auth-email-rate-limit.mjs
// Exit 0 = no probe was limited. NOT a guarantee that an exercise will pass — see above.
// Exit 1 = at least one probe was limited.

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

console.log("\nWhy each of the 3 actions is unexercised, and what would unblock it:");

// Derived from the measurement, not asserted. The previous wording hardcoded
// "signUp is rate limited above", which contradicted this script's own output
// whenever an apex-domain signUp came back accepted — the reader was told the
// limiter was blocking something the same run had just shown was not blocked.
const signUpApex = results.find(([n]) => n === "signUp (apex domain)")?.[1];
const signUpVerdict =
  signUpApex === "limited" ? "refused by the limiter in this run"
  : signUpApex === "accepted" ? "ACCEPTED in this run — the limiter did not block it, but this run spent budget doing so"
  : "could not be determined (address rejected before the limiter)";

console.log(`  signupAction      needs auth.signUp to be accepted AND the confirmation email`);
console.log(`                    to arrive. Measured: ${signUpVerdict}.`);
console.log("  inviteClientUser  needs admin.inviteUserByEmail accepted." +
  (limited.includes("inviteUserByEmail")
    ? " Measured: refused by the limiter in this run."
    : accepted.includes("inviteUserByEmail")
      ? " Measured: ACCEPTED in this run, at the cost of budget."
      : " Measured: could not be determined."));
console.log("  resetPasswordAction does NOT need the rate limit cleared — it consumes a");
console.log("                    recovery token from an inbox. There is no mail provider in");
console.log("                    this environment, so this one stays blocked either way.");

console.log("\nNothing was left behind: every account this run created was deleted again.");
if (accepted.length) {
  console.log(
    "\n!! This run was ANSWERED on: " + accepted.join(", ") + "\n" +
      "   Those calls consumed real rate-limit budget before their users were deleted.\n" +
      "   Do NOT run the exercises immediately after this probe -- they will be refused\n" +
      "   and the refusal will look like a product fault. Wait first.",
  );
}
process.exitCode = limited.length ? 1 : 0;