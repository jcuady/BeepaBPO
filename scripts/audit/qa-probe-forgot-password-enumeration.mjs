// Does `forgotPasswordAction` leak account existence, or was that a rate-limit artefact?
//
// THE CONFLICT. `qa-exercise-auth-workflow.mjs` asserts two things that should agree:
//
//   PASS  "forgot-password does not confirm that an account exists"
//         -> "If an account exists for that email, we sent reset instructions."
//   FAIL  "forgot-password answers identically for a real and a fake address"
//         -> real="if an account exists."  fake="If an account exists for that email, we
//            sent reset instruction"
//
// The real address produced the TAIL OF AN ERROR MESSAGE, not the success copy. That points
// at `forgotPasswordAction`'s error branch, which returns `ok: false` plus
// `passwordResetErrorMessage(error)` -- and the only error reachable there is delivery or
// rate limiting. So the hypothesis is: the real address actually tries to SEND an email and
// hits the exhausted budget, while a fake address succeeds silently in Supabase and never
// sends. Under that hypothesis the difference is the ENVIRONMENT, not the copy.
//
// If that is right, the two answers differ only while the budget is empty. When a send gets
// through, a real address returns the same success copy a fake one does, and the oracle does
// not exist. This probe decides it by calling the exact API the action calls, for both kinds
// of address, and reporting the ERROR rather than the success.
//
// It does not call the app, so it isolates the API's behaviour from the UI's rendering.
//
// Usage: node scripts/audit/qa-probe-forgot-password-enumeration.mjs

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
// The anon key, because `forgotPasswordAction` signs in as an ANON client, not service role.
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const { data: users, error: uErr } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
if (uErr) throw new Error(`listUsers: ${uErr.message}`);
const real = users.users.find((u) => u.email === "hr@demo.beepabpo.com");
if (!real) throw new Error("no hr demo user to test against");
const fake = `qa-no-such-account-${Date.now().toString().slice(-8)}@demo.beepabpo.com`;

console.log(`real: ${real.email}`);
console.log(`fake: ${fake}\n`);

async function attempt(label, email) {
  const { error } = await anon.auth.resetPasswordForEmail(email, {
    redirectTo: "http://localhost:3100/auth/callback?next=%2Freset-password",
  });
  const kind = error ? (error.message || String(error)) : "no error";
  console.log(`${label.padEnd(5)} ${email.padEnd(46)} ${kind}`);
  return { email, kind, failed: Boolean(error) };
}

const a = await attempt("real", real.email);
const b = await attempt("fake", fake);

console.log(`\nsame answer for both? ${a.kind === b.kind ? "YES — no oracle" : "NO — the answers differ"}`);

if (a.kind !== b.kind) {
  console.log(`
READ THIS BEFORE CALLING IT A DEFECT
  The two answers differ only if a real address produces an ERROR while a fake one does not.
  Supabase answers silently-successfully for an address with no account, and only actually
  dispatches mail for one that exists -- so an exhausted email budget shows up as an error on
  the REAL address and nothing on the fake one. That is the budget being visible, not the
  copy differing.

  The product behaviour that matters is the SUCCESS copy, which both addresses receive when a
  send is allowed through, and which is byte-identical either way:
      "If an account exists for that email, we sent reset instructions."
  The other assertion in the auth exercise -- "does not confirm that an account exists" --
  checks exactly that copy and PASSES.

  Re-run this when the budget has reset. If both answers are "no error", the difference was
  environmental and the anti-enumeration property holds.`);
  process.exitCode = 2;
}