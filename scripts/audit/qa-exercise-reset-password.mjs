// Exercise `resetPasswordAction` end to end. 82nd of 83 server actions.
//
// WHY THIS WAS CALLED BLOCKED, AND WHY THAT WAS WRONG
// `resetPasswordAction` was listed as unexercisable because it "needs a recovery token from
// an inbox, and there is no mail provider in this environment". That is true of the EMAIL
// ARRIVAL and false of the ACTION.
//
// Reading the action is what shows it:
//     const { data: { user } } = await supabase.auth.getUser();
//     if (!user) return { ok: false, error: "This reset link is invalid or has expired." };
//     await supabase.auth.updateUser({ password: parsed.data.password });
// It never reads the token. It requires a live session and nothing else. So a session is
// sufficient input, and a session does not need a mailbox -- sign in and you have one.
// The emailed-link ARRIVAL stays untested here and is reported as such rather than claimed.
//
// WHAT IS AND IS NOT COVERED
//   covered  - schema validation, the no-session refusal, the update, and the round trip
//              that proves it: sign out, sign in with the NEW password.
//   not covered - the Supabase email arriving and the callback exchanging a PKCE code.
//              No mail provider here, and that gap is stated in the output, not hidden.
//
// The second leg tests a suspicion rather than a feature: `/reset-password` renders the
// password form whenever a `token` is in the URL EVEN IF no session exists, and the action
// ignores that token. If so the page offers a form whose submission can only ever fail.
//
// Usage: node scripts/audit/qa-exercise-reset-password.mjs

import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
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

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const STAMP = Date.now().toString().slice(-8);
const EMAIL = `qa-reset-${STAMP}@demo.beepabpo.com`;
const OLD_PASSWORD = `QaOld-${STAMP}!a`;
const NEW_PASSWORD = `QaNew-${STAMP}!b`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}

// Cleanup is scoped to ONE user id created by this run. `admin.createUser` sends no email
// and creates no membership, so the blast radius is one auth row plus anything a signup
// trigger created for it -- which is why the trigger's output is deleted explicitly rather
// than assumed absent.
let userId = null;
async function cleanup() {
  if (!userId) return;
  // Anything a signup trigger may have created for this id.
  await admin.from("organization_memberships").delete().eq("user_id", userId);
  await admin.from("profiles").delete().eq("id", userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  console.log(`cleanup: user ${userId} ${error ? `FAILED ${error.message}` : "deleted"}`);
  const { data: gone } = await admin.auth.admin.getUserById(userId).catch(() => ({ data: null }));
  console.log(`cleanup: verified gone = ${!gone?.user}`);
}

async function main() {
  // Straightforward, because the first version wrapped this in a `.then()` and handed the
  // result to `must()`. `must()` destructures `{ data, error }` off whatever it is given, so
  // an array came back as `data === undefined` -> `[]` -> `created[0].id` threw on undefined.
  // Same shape as the hire exercise's `const { data: moved } = await must(...)` mistake:
  // a helper that returns data must not be destructured as if it returned an envelope.
  const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: OLD_PASSWORD,
    email_confirm: true,
  });
  if (createErr || !createdUser?.user) {
    throw new Error(`create throwaway user: ${createErr?.message ?? "no user returned"}`);
  }
  userId = createdUser.user.id;
  console.log(`throwaway user: ${EMAIL}  ${userId}`);

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

    // ---- leg 1: no session, no token -> the page must refuse ----
    await page.goto(`${BASE}/reset-password`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const noTokenText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    check(
      "with no session and no token the page refuses",
      noTokenText.includes("Invalid link"),
      noTokenText.slice(0, 80),
    );

    // ---- leg 2: a token in the URL but still no session ----
    // This leg FOUND the defect. Against the original component it rendered a complete
    // "Choose a new password" form on the strength of the token alone, and submitting it
    // was refused with "This reset link is invalid or has expired" -- after the person had
    // typed a new password twice. The action requires a session and ignores the token.
    //
    // `ResetPasswordForm` now gates on the session, so the honest answer is the same
    // "Invalid link" panel as leg 1. Asserting the CORRECTED behaviour here is the point:
    // if someone re-widens the gate, this leg goes red again.
    await page.goto(`${BASE}/reset-password?token=qa-fake-token`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const tokenNoSessionBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const formStillRenders = (await page.locator("#password").count()) > 0;
    check(
      "a token without a session does NOT offer a form that cannot work",
      !formStillRenders && tokenNoSessionBody.includes("Invalid link"),
      formStillRenders
        ? "the password form is rendered but the action would refuse it"
        : tokenNoSessionBody.slice(0, 90),
    );

    // ---- leg 3: a real session -> the action works ----
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[type=email]', EMAIL);
    await page.fill('input[type=password]', OLD_PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    // Wait for the CONDITION the check asserts, not for a fixed number of milliseconds.
    // A throwaway user with no membership is redirected to /app/access-denied, and on a cold
    // server that took longer than 3s -- so the assertion read `/login` and failed while the
    // sign-in had in fact succeeded. Everything after it passed, including a sign-in with
    // the NEW password, which is what the failure should have told me at the time.
    const signedIn = await page
      .waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 })
      .then(() => true)
      .catch(() => false);
    check("signed in as the throwaway user", signedIn, page.url());

    await page.goto(`${BASE}/reset-password`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const sessionForm = await page.locator("#password").count();
    check("a signed-in user is offered the password form", sessionForm > 0, `#password count=${sessionForm}`);

    await page.fill("#password", NEW_PASSWORD);
    await page.fill("#confirmPassword", NEW_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    const afterBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    check("resetPasswordAction reports success", afterBody.includes("Password updated"), afterBody.slice(0, 110));

    // ---- the round trip that makes the claim mean something ----
    // A "success" message proves the action returned ok. Proving the PASSWORD CHANGED
    // requires signing out and signing back in with the new one.
    await ctx.clearCookies();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[type=email]', EMAIL);
    await page.fill('input[type=password]', NEW_PASSWORD);
    await page.click('button[type=submit]');
    const newPwSignedIn = await page
      .waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 })
      .then(() => true)
      .catch(() => false);
    check("the NEW password actually works", newPwSignedIn, page.url());

    // And the old one must not.
    await ctx.clearCookies();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    // And the old one must not. Wait for the REJECTION to appear rather than for a timeout --
    // asserting "still on /login" after N ms would also pass if the form had simply not
    // submitted yet, which is a check that cannot fail for the reason it claims.
    await page.fill('input[type=email]', EMAIL);
    await page.fill('input[type=password]', OLD_PASSWORD);
    await page.click('button[type=submit]');
    const rejected = await page
      .waitForFunction(
        () => /invalid|incorrect|do not match|error/i.test(document.body.innerText),
        null,
        { timeout: 25000 },
      )
      .then(() => true)
      .catch(() => false);
    const stayedOnLogin = page.url().includes("/login");
    check("the OLD password no longer works", rejected && stayedOnLogin, `rejection shown=${rejected}, url=${page.url()}`);

    check("0 console errors", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
    await ctx.close();
  } finally {
    await browser.close().catch(() => {});
    await cleanup();
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    process.exitCode = 1;
  })
  .finally(() => {
    const failed = results.filter((r) => !r.pass);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) process.exitCode = 1;
    console.log("NOT COVERED: the recovery email arriving, and /auth/callback exchanging a PKCE code (no mail provider here).");
  });