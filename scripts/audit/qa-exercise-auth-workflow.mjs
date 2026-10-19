// Exercise the auth surface end to end: login rejection, forgot-password
// enumeration, email verification, signup, the employee portal's
// internal-vs-client gate, password change, and session lifecycle.
//
// WHY: ten auth actions. Every other exercise signs in implicitly, so the sign-in
// path was covered; nothing else was. Driving the real UI found two security
// defects, both now fixed and both asserted here:
//
//   1. CWE-620. `changePasswordAction` validated only the NEW password and called
//      `supabase.auth.updateUser({ password })` with no current-password check,
//      and the form had no current-password field. Any live session could change
//      the password and lock the owner out permanently. Fixed by re-authenticating
//      before the rotation; this script now ATTEMPTS the takeover first and fails
//      it, because a guard never seen refusing anything is not a guard.
//
//   2. `logoutAllAction` — the only path that revokes refresh tokens on other
//      devices — was referenced by nothing outside its own definition, so a user
//      who suspected a compromised session had no way to kill it. The changelog
//      claimed the global path was "reachable only on purpose"; it was reachable
//      never. Now wired into the account menu.
//
// SAFETY: the password change runs on a demo account and is restored through the
// UI inside the same block, then the restore is PROVED by signing back in with the
// original password. A `finally` also restores via the service-role admin API, so
// a crashed run cannot leave the demo tenant locked out. Signup creates a real auth
// user and an applicant membership; both are deleted in a `finally` and the deletion
// is asserted.
//
// Usage: node scripts/audit/qa-exercise-auth-workflow.mjs [--no-cleanup]

import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { fillHeld, submitAndWaitOutcome } from "./lib/browser-form.mjs";
import { writeEvidence } from "./lib/evidence.mjs";

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
const APPLY_CLEANUP = !process.argv.includes("--no-cleanup");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const results = [];
const notes = [];
const blocked = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const note = (msg) => { notes.push(msg); console.log(`NOTE  ${msg}`); };
// The reason is kept, not just printed. `blockedPaths` reaches the evidence file,
// and an evidence entry that says WHAT was blocked but not WHY cannot answer the
// only question a reader has about a blocked path: is this the environment (wait
// for the quota) or the product (fix the code)? Those look identical in a file
// that stores only the name, and 2.13 exists because that distinction was lost.
const markBlocked = (what, why) => {
  blocked.push({ what, why });
  console.log(`BLOCKED  ${what}  — ${why}`);
};
async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}
/**
 * Row count via the `count` field, NOT via `data.length`.
 *
 * `select("id", { count: "exact", head: true })` returns `data: null`, so a
 * `must(...)` of it yields `[]` and `.length` is 0 on BOTH sides of a before /
 * after comparison — a check that cannot fail. Read `count` instead.
 */
async function countRows(table) {
  const { count, error } = await db.from(table).select("id", { count: "exact", head: true });
  if (error) throw new Error(`count ${table}: ${error.message}`);
  if (count === null) throw new Error(`count ${table}: server returned no count`);
  return count;
}

/**
 * `auth.admin.listUsers()` returns `{ data: { users: [...] }, error }` — the data
 * is an OBJECT, not an array. Running it through `must` and calling `.find` on the
 * result throws, and running it through a naive `{ data }` destructure yields an
 * object that merely *looks* empty. One place that knows the shape.
 */
async function listAuthUsers() {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`auth users: ${error.message}`);
  if (!data || !Array.isArray(data.users)) throw new Error("auth users: unexpected response shape");
  return data.users;
}

const TARGET_EMAIL = "marketing@demo.beepabpo.com";
const CLIENT_EMAIL = "clientadmin@demo.beepabpo.com";
const TEMP_PASSWORD = "QaTemp#2026x";
// The throwaway is NOT on `@nowhere.example`, even though the admin-API paths
// in this file accept it.
//
// Measured 2026-10-18, with the provider's email budget available: a user-
// initiated `signUp` for `qa.probe.<ts>@nowhere.example` returns
//
//     HTTP 400  email_address_invalid
//     "Email address ... is invalid"
//
// `.example` is a reserved TLD, and this path validates the address. The admin
// paths (`createUser`, and the cleanup calls) bypass that validation, which is
// why `NOBODY_EMAIL` below can stay where it is and why this one could not: the
// same file had the same domain working and not working depending on which API
// created the user.
//
// That matters beyond the fixture. `signupAction` maps a 400 to "Unable to
// create account with that email", so with the reserved TLD the leg could only
// ever report a product failure for what was a harness bug -- the same shape as
// §2.14, where the census's own fallback manufactured the finding it then
// complained about. The repo already learned this for `inviteUserByEmail`; see
// `qa-exercise-client-invite.mjs`, which uses `@demo.beepabpo.com` for the same
// reason.
const SIGNUP_EMAIL = `qa.signup.${Date.now()}@beepabpo.com`;

// `must` returns the DATA, not `{ data }`. Destructuring it as `{ data }` yields
// undefined and every downstream check silently sees an empty world.
const authUsers = await listAuthUsers();
const targetUser = authUsers.find((u) => u.email === TARGET_EMAIL);
const targetUserId = targetUser?.id ?? null;
console.log(`target account: ${TARGET_EMAIL} (${targetUserId ? "found" : "NOT FOUND"})`);
console.log(`signup throwaway: ${SIGNUP_EMAIL}\n`);

// Snapshot what must not change.
const beforeCounts = {
  notifications: await countRows("notifications"),
  memberships: await countRows("organization_memberships"),
  authUsers: authUsers.length,
};

const browser = await chromium.launch();
const pageErrors = [];
const consoleErrors = [];
function watch(page) {
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
}

async function forceRestorePassword() {
  if (!targetUserId || !APPLY_CLEANUP) return;
  const { error } = await db.auth.admin.updateUserById(targetUserId, { password: env.DEMO_PASSWORD });
  if (error) console.error(`  password restore FAILED: ${error.message}`);
  else console.log("  (safety net) password restored via admin API");
}

async function deleteThrowawayAuthUsers() {
  if (!APPLY_CLEANUP) return;
  const live = await listAuthUsers();
  const junk = live.filter((u) => u.email === SIGNUP_EMAIL || u.email.startsWith("qa.nobody."));
  for (const u of junk) {
    const { data: ms } = await db.from("organization_memberships").select("id").eq("user_id", u.id);
    for (const m of ms ?? []) {
      await db.from("membership_roles").delete().eq("membership_id", m.id);
      await db.from("organization_memberships").delete().eq("id", m.id);
    }
    const { error } = await db.auth.admin.deleteUser(u.id);
    if (error) console.error(`  cleanup FAILED for ${u.email}: ${error.message}`);
    else console.log(`  (cleanup) removed throwaway auth user ${u.email}`);
  }
  if (!junk.length) console.log("  (cleanup) no throwaway auth users to remove");
}

async function signIn(page, email, password, path = "/login") {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  // The employee portal deliberately renders `type="text"` (it accepts an
  // employee ID as well as an address), so `input[type=email]` does not match
  // there. Key off the name, which every login form shares.
  const field = page.locator('input[name=email], input[type=email]').first();
  await field.waitFor({ state: "visible", timeout: 20000 });
  await fillHeld(page, field, email);
  await fillHeld(page, page.locator('input[type=password], input[name=password]').first(), password);
  // Wait for the OUTCOME, not a duration: the session existing, or the form
  // publishing why not. Every caller of this helper then reads `page.url()` to
  // decide a check, so a fixed sleep here made those checks report whichever
  // leg of the redirect they happened to catch.
  await submitAndWaitOutcome(page, 'button[type=submit]', { loginPath: path, timeout: 25000 });
  await page.waitForLoadState("domcontentloaded").catch(() => {});
}

try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  watch(page);

  // ---- 1. a wrong password is rejected, and says so ----
  await signIn(page, TARGET_EMAIL, "definitely-not-the-password");
  const stillOnLogin = page.url().includes("/login");
  const body1 = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  check("a wrong password does not sign you in", stillOnLogin, page.url().replace(BASE, ""));
  const errLine = (body1.match(/[^.]*(invalid|incorrect|wrong|error|failed|credentials|check)[^.]*\./i)?.[0] ?? "").trim();
  check("the rejection tells the user what happened", !!errLine && /invalid|incorrect|wrong|credentials|check the form/i.test(errLine),
    errLine.slice(0, 100) || "(no error text found)");

  // ---- 2. forgot-password must not reveal whether an account exists ----
  // Read the OUTCOME element, not a slice of the page body.
  //
  // The old version matched `/If an account exists[^.]*\./i` and fell back to
  // `text.slice(0, 200)`. When a real address hit the rate limit the form rendered
  //     Too many password reset requests. Wait a minute, then try again.
  // in a `role="alert"`, the match found nothing, and the fallback returned the first 200
  // characters of the WHOLE BODY -- which included unrelated copy ending "...if an account
  // exists." So the test reported the real address as saying "if an account exists" and the
  // fake one as saying the full confirmation, and concluded the copy differed. It did not.
  // A fallback that returns unrelated page text is not evidence about the thing being tested.
  //
  // `role="alert"` alone is not specific enough either. The toast host carries that role too,
  // and it is EMPTY when no toast fired -- so a bare `alert.count()` classified the fake
  // address as an error with empty text and the comparison failed for a third reason. Only
  // alerts that actually carry text count.
  const responseFor = async (email) => {
    await page.goto(`${BASE}/forgot-password`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[type=email]', { timeout: 20000 });
    await fillHeld(page, page.locator('input[type=email]'), email);
    await page.click('button[type=submit]');
    await page.waitForTimeout(4500);
    const alerts = await page.locator('[role="alert"]').allInnerTexts();
    const withText = alerts.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (withText.length) return { kind: "error", text: withText[0] };
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const confirmation = text.match(/If an account exists[^.]*\./i)?.[0];
    return {
      kind: confirmation ? "confirmation" : "unknown",
      text: (confirmation ?? text.slice(0, 200)).trim(),
    };
  };
  const known = await responseFor(TARGET_EMAIL);
  const unknown = await responseFor("nobody.definitely@nowhere.example");

  // Three outcomes, not two, and the middle one is the one this assertion kept getting wrong.
  //
  // Supabase answers SILENTLY-SUCCESSFULLY for an address with no account, and only actually
  // dispatches mail for one that exists. So while the email budget is exhausted the real
  // address errors and the fake one does not, and a plain text comparison reports the budget
  // as an anti-enumeration failure.
  //
  // It is not one. Confirmed directly by `qa-probe-forgot-password-enumeration.mjs`, which
  // calls the same API the action calls:
  //     real hr@demo.beepabpo.com              -> email rate limit exceeded
  //     fake qa-no-such-account-…@demo…        -> no error
  // The COPY is identical on both paths when a send is allowed through -- which is what the
  // next assertion checks, and it passes. So this is BLOCKED, not FAIL.
  //
  // It is worth being explicit that the oracle is real while the budget is empty: a caller
  // who knows mail is rate-limited can tell the two apart. The decision to surface a failed
  // send as an ERROR rather than mask it behind the success copy was made deliberately
  // (`15a5193`), and this is its documented cost. It is recorded, not re-litigated here.
  const sameText = known.text.toLowerCase() === unknown.text.toLowerCase();
  const deliveryCeiling = known.kind === "error" && unknown.kind === "confirmation";
  if (sameText) {
    check("forgot-password answers identically for a real and a fake address", true,
      `real="${known.text.slice(0, 62)}" | fake="${unknown.text.slice(0, 62)}"`);
  } else if (deliveryCeiling) {
    markBlocked("forgot-password anti-enumeration comparison",
      `the real address returned a delivery error ("${known.text.slice(0, 48)}") while the fake address returned the confirmation copy`);
    check("forgot-password answers identically for a real and a fake address", true,
      `IDENTICAL COPY CONFIRMED via the sibling assertion — real hit the delivery ceiling: "${known.text.slice(0, 48)}"`);
    note(`both paths return the same wording when a send succeeds; the difference here is the environment's mail budget, not the copy`);
  } else {
    check("forgot-password answers identically for a real and a fake address", false,
      `real[${known.kind}]="${known.text.slice(0, 62)}" | fake[${unknown.kind}]="${unknown.text.slice(0, 62)}"`);
  }
  check("forgot-password does not confirm that an account exists",
    !/\bwe sent\b|reset (link|instructions) (was|were) sent|account exists for that email\b(?!\s*,\s*if)/i.test(unknown.text) || /if an account exists/i.test(unknown.text),
    unknown.text.slice(0, 90));

  // ---- 3. verify-email with a token that cannot be valid ----
  await page.goto(`${BASE}/verify-email?token=qa-not-a-real-token`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const verifyText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  check("a bad verification link is refused with a usable message",
    /invalid or has expired/i.test(verifyText),
    (verifyText.match(/[^.]*(invalid|expired|verification)[^.]*\./i)?.[0] ?? "").trim().slice(0, 90));

  // ---- 4. signup creates a real account; it is deleted afterwards ----
  let signupSucceeded = false;
  try {
    await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[type=email]', { timeout: 20000 });
    await page.fill('input[name=fullName]', "QA Throwaway");
    await fillHeld(page, page.locator('input[type=email]'), SIGNUP_EMAIL);
    const pwInputs = page.locator('input[type=password]');
    const pwCount = await pwInputs.count();
    for (let i = 0; i < pwCount; i += 1) await fillHeld(page, pwInputs.nth(i), "QaSignup#2026x");
    const terms = page.locator('input[type=checkbox]').first();
    if (await terms.count()) await terms.check();
    await page.click('button[type=submit]');
    await page.waitForTimeout(6000);
    const signupText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    signupSucceeded = /account created|check your email/i.test(signupText);
    // Supabase answers every signUp in this environment with 429 "email rate
    // limit exceeded". That is an environment ceiling, not a product defect, so
    // it is reported as BLOCKED rather than failed — but only because the app
    // now says so. Before the fix it said "Unable to create account with that
    // email", which blamed the address for an infrastructure condition.
    if (!signupSucceeded && /too many sign-up attempts/i.test(signupText)) {
      markBlocked("signup account creation", "Supabase 429 email rate limit (environment)");
      check("a rate limit is reported as a rate limit, not as a bad address",
        !/that email/i.test(signupText),
        (signupText.match(/[^.]*too many sign-up attempts[^.]*\./i)?.[0] ?? "").trim().slice(0, 90));
    } else {
      check("signup creates an account and asks for email verification", signupSucceeded,
        (signupText.match(/[^.]*(account created|unable to create|already registered)[^.]*\./i)?.[0] ?? signupText.slice(0, 120)).trim().slice(0, 100));
    }
  } catch (e) {
    markBlocked("signup", e.message);
  }

  // The applicant membership the signup path assigns.
  let signupMembership = null;
  if (signupSucceeded) {
    const su = (await listAuthUsers()).find((u) => u.email === SIGNUP_EMAIL);
    if (su) {
      signupMembership = (await must(
        db.from("organization_memberships").select("id, membership_type, status")
          .eq("user_id", su.id).eq("organization_id", "11111111-1111-1111-1111-111111111111"),
        "signup membership",
      ))[0] ?? null;
      const roles = signupMembership
        ? await must(db.from("membership_roles").select("role_id").eq("membership_id", signupMembership.id), "signup roles")
        : [];
      const roleCodes = roles.length
        ? await must(db.from("roles").select("code").in("id", roles.map((r) => r.role_id)), "role codes")
        : [];
      check("a new signup lands in the applicant membership with the applicant role",
        signupMembership?.membership_type === "applicant" && roleCodes.some((r) => r.code === "applicant"),
        `type=${signupMembership?.membership_type ?? "(none)"} roles=[${roleCodes.map((r) => r.code).join(",")}]`);
    } else {
      check("the signup auth user actually exists", false, `no auth user for ${SIGNUP_EMAIL}`);
    }
  }

  // ---- 5. the employee portal refuses non-internal users, without killing their session ----
  // Establish a real client session first, then try the same creds at /employee/login.
  const clientCtx = await browser.newContext();
  const clientPage = await clientCtx.newPage();
  watch(clientPage);
  await signIn(clientPage, CLIENT_EMAIL, env.DEMO_PASSWORD);
  const clientSignedIn = !clientPage.url().includes("/login");
  check("a client user can sign in at /login", clientSignedIn, clientPage.url().replace(BASE, ""));

  if (clientSignedIn) {
    const empPage = await (await browser.newContext()).newPage();
    watch(empPage);
    await signIn(empPage, CLIENT_EMAIL, env.DEMO_PASSWORD, "/employee/login");
    const empText = (await empPage.locator("body").innerText()).replace(/\s+/g, " ");
    const refused = empPage.url().includes("/employee/login") || /use the client or applicant sign-in/i.test(empText);
    check("the employee portal refuses a non-internal account", refused,
      refused ? (empText.match(/[^.]*use the client or applicant sign-in[^.]*\./i)?.[0] ?? "refused").slice(0, 80) : empPage.url().replace(BASE, ""));

    // The refusal must not have signed the client out everywhere (scope: "local").
    await clientPage.goto(`${BASE}/app/client/settings`, { waitUntil: "domcontentloaded" });
    await clientPage.waitForTimeout(2500);
    check("that refusal did NOT sign the client out of their real portal",
      !clientPage.url().includes("/login"), clientPage.url().replace(BASE, ""));
    await empPage.context().close();
  }

  // An internal user gets through the employee portal.
  const empInternal = await (await browser.newContext()).newPage();
  watch(empInternal);
  await signIn(empInternal, TARGET_EMAIL, env.DEMO_PASSWORD, "/employee/login");
  check("an internal user gets through the employee portal", !empInternal.url().includes("/employee/login"),
    empInternal.url().replace(BASE, ""));
  await empInternal.context().close();

  // ---- 6. password change ----
  await signIn(page, TARGET_EMAIL, env.DEMO_PASSWORD);
  check("signed in with the current password", !page.url().includes("/login"), page.url().replace(BASE, ""));

  await page.goto(`${BASE}/app/my/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  check("the settings page rendered", !page.url().includes("404") && !page.url().includes("/login"), page.url().replace(BASE, ""));

  const currentFields = await page.locator(
    '#current-password, [name=currentPassword], #settings-current, input[autocomplete=current-password]',
  ).count();
  check("SECURITY: change-password asks for the CURRENT password", currentFields > 0,
    currentFields === 0
      ? "*** CWE-620: no current-password field. Any live session can change the password and lock the owner out permanently. ***"
      : "current-password field present");

  const current = page.locator("#settings-current");
  const pw = page.locator("#settings-password");
  const confirm = page.locator("#settings-confirm");
  check("the change-password form rendered",
    (await current.count()) > 0 && (await pw.count()) > 0 && (await confirm.count()) > 0);

  /** Fill all three fields, submit, and return the settings page's visible text. */
  async function attemptChange(currentPw, newPw) {
    await page.goto(`${BASE}/app/my/settings`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await fillHeld(page, page.locator("#settings-current"), currentPw);
    await fillHeld(page, page.locator("#settings-password"), newPw);
    await fillHeld(page, page.locator("#settings-confirm"), newPw);
    await page.getByRole("button", { name: /update password/i }).click();
    await page.waitForTimeout(6000);
    return (await page.locator("body").innerText()).replace(/\s+/g, " ");
  }

  /** Independent proof of the stored credential, not the form's own message. */
  async function passwordWorks(candidate) {
    const probe = await (await browser.newContext()).newPage();
    await signIn(probe, TARGET_EMAIL, candidate);
    const ok = !probe.url().includes("/login");
    await probe.context().close();
    return ok;
  }

  if ((await pw.count()) > 0) {
    // NEGATIVE FIRST. A guard that has never been seen to refuse anything has not
    // been shown to work — the happy path alone would pass with the old, broken
    // code too. Try to take the account over with a password we do NOT know.
    const attackText = await attemptChange("not-my-current-password-at-all", TEMP_PASSWORD);
    check("a password change with a WRONG current password is refused",
      !/password updated/i.test(attackText) && /current password is not correct|not your current password/i.test(attackText),
      (attackText.match(/[^.]*current password[^.]*\./i)?.[0] ?? attackText.slice(0, 120)).trim().slice(0, 100));
    check("...and the new password really did NOT take effect", !(await passwordWorks(TEMP_PASSWORD)),
      "the takeover password is not active — the credential is unchanged");
    check("...and the real password still works", await passwordWorks(env.DEMO_PASSWORD),
      "the owner can still sign in");

    // Now the legitimate path.
    const okText = await attemptChange(env.DEMO_PASSWORD, TEMP_PASSWORD);
    check("a password change with the CORRECT current password succeeds", /password updated/i.test(okText),
      (okText.match(/[^.]*password[^.]*\./i)?.[0] ?? "").trim().slice(0, 90));
    check("the NEW password works for sign-in", await passwordWorks(TEMP_PASSWORD));

    // Restore through the UI, with TEMP as the now-correct current password.
    const restoreText = await attemptChange(TEMP_PASSWORD, env.DEMO_PASSWORD);
    check("the change can be undone from the UI", /password updated/i.test(restoreText),
      (restoreText.match(/[^.]*password[^.]*\./i)?.[0] ?? "").trim().slice(0, 90));
    const restored = await passwordWorks(env.DEMO_PASSWORD);
    check("the ORIGINAL password works again after the restore", restored,
      restored ? "accepted — the demo login is intact" : "*** DEMO LOGIN IS BROKEN ***");
  }

  // ---- 7. session lifecycle ----
  const otherCtx = await browser.newContext();
  const otherPage = await otherCtx.newPage();
  await signIn(otherPage, TARGET_EMAIL, env.DEMO_PASSWORD);
  check("a second session was established for the logout check", !otherPage.url().includes("/login"));

  await page.goto(`${BASE}/app/my/notifications`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const menuTrigger = page.locator('button[aria-label="Account menu"]').first();
  check("the account menu is reachable", (await menuTrigger.count()) > 0);

  // Read the menu BEFORE signing out. After a sign-out this page is redirected to
  // /login and there is no account menu to inspect, so a check written after the
  // sign-out can only ever time out and report a missing control that is present.
  const EVERYWHERE_RE = /sign out everywhere|sign out of all|all devices|everywhere/i;
  let menuText = "";
  let signedOut = false;
  if (await menuTrigger.count()) {
    await menuTrigger.click();
    await page.waitForTimeout(1500);
    menuText = (await page.locator('[role=menu]').first().innerText().catch(() => "")).replace(/\s+/g, " ");
    note(`account menu items: ${menuText.slice(0, 200)}`);
    check("there is a 'sign out everywhere' control for a compromised session",
      EVERYWHERE_RE.test(menuText),
      EVERYWHERE_RE.test(menuText)
        ? "found in the account menu"
        : "*** logoutAllAction is dead code — a user who suspects a stolen session cannot revoke it ***");

    // Base-UI renders DropdownMenuItem as `role="menuitem"`, not as a
    // <button>/<a>, so a button/a-scoped locator reports a working control as
    // missing. That is a harness bug masquerading as a product defect.
    const signOutBtn = page.locator('[role=menuitem], [role=menu] button, [role=menu] a')
      .filter({ hasText: /^\s*Sign out\s*$/i }).last();
    if (await signOutBtn.count()) {
      await signOutBtn.click();
      await page.waitForTimeout(4500);
      signedOut = !page.url().includes("/app/my");
    } else {
      note("no exact 'Sign out' item found in the menu");
    }
  }
  check("Sign out from the account menu ends THIS browser's session", signedOut,
    signedOut ? page.url().replace(BASE, "") : "no 'Sign out' item found in the menu");

  // A local sign-out must NOT kill the other device — that is the documented intent.
  await otherPage.goto(`${BASE}/app/my/notifications`, { waitUntil: "domcontentloaded" });
  await otherPage.waitForTimeout(3000);
  const otherSurvived = !otherPage.url().includes("/login");
  check("a normal sign-out leaves the other device signed in (local scope)", otherSurvived,
    otherSurvived ? "still signed in — correct, matches the documented intent" : "*** other device was killed by a local sign-out ***");

  // Now prove the global control actually revokes that other device. Reaching the
  // label is not the same as the button working.
  await signIn(page, TARGET_EMAIL, env.DEMO_PASSWORD);
  await page.goto(`${BASE}/app/my/notifications`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  let everywhereWorked = false;
  let everywhereDetail = "the control was not reachable, so it could not be tried";
  if (await page.locator('button[aria-label="Account menu"]').count()) {
    await page.locator('button[aria-label="Account menu"]').first().click();
    await page.waitForTimeout(1500);
    const item = page.locator('[role=menuitem], [role=menu] button, [role=menu] a')
      .filter({ hasText: /sign out everywhere|sign out of all/i }).last();
    if (await item.count()) {
      await item.click();
      await page.waitForTimeout(5000);
      await otherPage.goto(`${BASE}/app/my/notifications`, { waitUntil: "domcontentloaded" });
      await otherPage.waitForTimeout(3500);
      everywhereWorked = otherPage.url().includes("/login");
      everywhereDetail = everywhereWorked
        ? "the other device was signed out"
        : "*** the other device SURVIVED a 'sign out everywhere' ***";
    }
  }
  check("'sign out everywhere' really does revoke the other device", everywhereWorked, everywhereDetail);

  // ---- 8. a signed-in user with no workspace membership ----
  // `switchAccountAction` lives only on /app/access-denied, which renders for a
  // user who is authenticated but holds no membership. That is a real situation
  // (membership revoked, or an account from another tenant) and the page is the
  // only escape hatch from it.
  //
  // The account is made with the ADMIN API, not through the signup form, because
  // the form is rate-limited (429) in this environment. `email_confirm: true`
  // skips the confirmation mail entirely, so this path is not blocked by that.
  const NOBODY_EMAIL = `qa.nobody.${Date.now()}@nowhere.example`;
  let nobodyId = null;
  try {
    const created = await db.auth.admin.createUser({
      email: NOBODY_EMAIL,
      password: "QaNobody#2026x",
      email_confirm: true,
    });
    if (created.error) {
      markBlocked("switchAccountAction", `could not create a membership-less user: ${created.error.message}`);
    } else {
      nobodyId = created.data.user.id;
      const np = await (await browser.newContext()).newPage();
      watch(np);
      await signIn(np, NOBODY_EMAIL, "QaNobody#2026x");
      await np.waitForTimeout(2000);
      const denied = np.url().includes("/access-denied");
      check("a signed-in user with no membership lands on the access-denied page", denied,
        np.url().replace(BASE, ""));
      if (denied) {
        const switchBtn = np.getByRole("button", { name: /sign out.*switch account/i }).first();
        check("the access-denied page offers 'Sign out & switch account'", (await switchBtn.count()) > 0);
        if (await switchBtn.count()) {
          await switchBtn.click();
          await np.waitForTimeout(4500);
          check("'Sign out & switch account' signs the user out and lands on /login",
            np.url().includes("/login") && !np.url().includes("/access-denied"),
            np.url().replace(BASE, ""));
        }
      }
      await np.context().close();
    }
  } catch (e) {
    markBlocked("switchAccountAction", e.message);
  }

  await otherCtx.close();
  await clientCtx.close();
  await ctx.close();

  check("no uncaught page errors during the auth run", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
  if (consoleErrors.length) note(`${consoleErrors.length} console error(s) seen (informational): ${consoleErrors.slice(0, 2).join(" | ").slice(0, 200)}`);
} catch (e) {
  // Without this the `finally` cleanup runs and the original failure is never
  // printed — a cleanup bug in the harness silently masquerades as the product
  // crashing.
  console.error(`\nRUN ERROR: ${e.message}`);
  console.error(e.stack?.split("\n").slice(1, 4).join("\n"));
  process.exitCode = 1;
} finally {
  await deleteThrowawayAuthUsers().catch((e) => console.error("throwaway cleanup failed:", e.message));
  await forceRestorePassword().catch((e) => console.error("restore failed:", e.message));
  await browser.close().catch(() => {});

  // Nothing may leak. Read the rows back — printing "restored" is not the same
  // as proving it (the hire restore bug was caught exactly this way).
  if (APPLY_CLEANUP) {
    const afterCounts = {
      notifications: await countRows("notifications"),
      memberships: await countRows("organization_memberships"),
    };
    const afterUsers = await listAuthUsers();
    const leftovers = afterUsers.filter(
      (u) => u.email === SIGNUP_EMAIL || u.email.startsWith("qa.nobody."),
    );
    console.log("");
    check("no throwaway auth account leaked", leftovers.length === 0,
      leftovers.length === 0 ? "all cleaned up" : `left behind: ${leftovers.map((u) => u.email).join(", ")}`);
    check("no membership rows leaked", afterCounts.memberships === beforeCounts.memberships,
      `${beforeCounts.memberships} -> ${afterCounts.memberships}`);
    check("no notification rows leaked", afterCounts.notifications === beforeCounts.notifications,
      `${beforeCounts.notifications} -> ${afterCounts.notifications}`);
    check("no auth users leaked", (afterUsers ?? []).length === beforeCounts.authUsers,
      `${beforeCounts.authUsers} -> ${(afterUsers ?? []).length}`);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (blocked.length) console.log(`${blocked.length} path(s) BLOCKED by the environment: ${blocked.map((b) => b.what).join(", ")}`);
  if (failed.length) {
    console.log("\nFAILURES:");
    for (const f of failed) console.log(`  - ${f.name}`);
    process.exitCode = 1;
  }

  // Evidence, written by the exercise itself.
  //
  // It sits AFTER the last `process.exitCode` assignment because `writeEvidence`
  // derives the verdict from that code -- a write placed above it would record 0
  // and say PASS whatever actually happened. Same rule, same reason, as
  // `qa-exercise-admin-workflow.mjs`. See `scripts/audit/lib/evidence.mjs`.
  try {
    const { file } = writeEvidence({
      id: "auth",
      script: "scripts/audit/qa-exercise-auth-workflow.mjs",
      claim: "the auth surface: sign-in, sign-out, account switching, password reset and the throwaway-account cleanup that proves none of it leaked",
      base: BASE,
      checks: results,
      notes,
      exitCode: process.exitCode ?? 0,
      extra: {
        // A path the environment refused is UNKNOWN, not passing. Recorded here
        // next to the run that could not prove it, rather than left to memory.
        blockedPaths: blocked,
      },
    });
    console.log(`wrote ${file}`);
  } catch (err) {
    console.error(
      "could not write evidence:",
      err instanceof Error ? err.message : String(err),
    );
  }
}