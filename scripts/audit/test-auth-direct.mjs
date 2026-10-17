// Is a failing sign-in the product, or the auth provider's rate limiter?
//
// WHY THIS FILE EXISTS
// --------------------
// Every audit exercise that signs in does it through the browser: fill the
// form, submit, watch the URL. When a sign-in fails, that measurement cannot
// tell three different things apart:
//
//   1. the app rejected the credentials,
//   2. Supabase's password-grant rate limiter refused the request, or
//   3. the redirect had not finished.
//
// All three look identical from inside the browser -- the form is still there.
// On 2026-10-17 that ambiguity cost a full day of false attribution: four
// separate runs of `qa-exercise-uncovered-roles.mjs` failed on four different
// accounts, and the failing set GREW as more runs were made, which is the
// signature of an exhausted budget rather than of a bug.
//
// So this asks the provider directly. It performs the same password grant
// that the login form performs, against Supabase's own REST endpoint, with no
// browser and no Next.js in the path. Whatever it returns is the provider's
// answer, and it cannot be a redirect race.
//
// It NEVER prints a key, a token, or a password -- only the HTTP status and
// the provider's error code, which is what decides attribution.
//
// Usage:
//   node --env-file=.env.local scripts/audit/test-auth-direct.mjs [email ...]
//   pnpm qa:auth-probe
//
// The package alias is deliberately `qa:`, not `audit:`. `audit-gate-coverage.mjs`
// treats every `audit:*` / `verify:*` / `smoke:*` / `seed:*` script as a claim that
// some release gate runs it, and exits 1 when one is wired to nothing. This probe
// is not a release gate: it makes a live network call to the auth provider, so it
// could fail a release for a reason that has nothing to do with the release.
// Declaring it `audit:` would have turned the gate red, and quietly renaming it
// back to `qa:` would have hidden a real gap. Naming it for what it is -- a
// diagnostic you reach for at step 2 of the attribution order in
// REMAINING_WORK 2.12c -- is the honest option.
//
// Verdict:
//   OK       every account granted a session
//   THROTTLED  at least one account refused with 429 / too_many_requests
//   REJECTED   refused with bad credentials -- a real sign-in defect
//   UNKNOWN    refused for some other reason; the message is printed

import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, i).trim()] = v;
}

const url = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
if (!url || !anon) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing from .env.local");
  process.exit(1);
}

const ACCOUNTS = (process.argv.slice(2).length ? process.argv.slice(2) : [
  "owner@demo.beepabpo.com",
  "hr@demo.beepabpo.com",
  "sales@demo.beepabpo.com",
  "finance@demo.beepabpo.com",
  "clientadmin@demo.beepabpo.com",
  "clientviewer@demo.beepabpo.com",
]).map((e) => e.trim());

const results = [];

for (const email of ACCOUNTS) {
  let status = 0;
  let code = "";
  let message = "";
  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password: env.DEMO_PASSWORD }),
    });
    status = res.status;
    const body = await res.json().catch(() => ({}));
    code = body?.error_code || body?.code || "";
    message = body?.error_description || body?.msg || body?.message || "";
  } catch (e) {
    message = String(e).slice(0, 120);
  }

  // The provider distinguishes these; a 429 is a spent budget, not a bad
  // password, and conflating the two is what makes a run unattributable.
  const throttled = status === 429 || /too many|rate limit|too_many/i.test(message);
  const rejected = status === 400 && /invalid login/i.test(message);

  results.push({ email, status, code, message, throttled, rejected });
  console.log(
    `${email.padEnd(34)} HTTP ${status}  ${throttled ? "THROTTLED" : rejected ? "REJECTED" : "granted"}` +
      `${message ? `  ${message}` : ""}`,
  );
}

const throttled = results.filter((r) => r.throttled).length;
const rejected = results.filter((r) => r.rejected).length;
const unknown = results.filter((r) => !r.throttled && !r.rejected && r.status >= 400).length;

console.log("");
let verdict;
if (throttled) {
  verdict = `THROTTLED — ${throttled}/${results.length} account(s) refused by the provider's rate limiter. A sign-in failure in a browser run is the provider, not the app.`;
} else if (rejected) {
  verdict = `REJECTED — ${rejected}/${results.length} account(s) refused with bad credentials. That is a real sign-in defect.`;
} else if (unknown) {
  verdict = `UNKNOWN — ${unknown}/${results.length} refused for a reason this probe does not classify; the messages above are the evidence.`;
} else {
  verdict = "OK — every account was granted a session, so any sign-in failing in a browser run is the app's or the run's, not the provider's.";
}
console.log(verdict);
process.exit(throttled || rejected || unknown ? 3 : 0);