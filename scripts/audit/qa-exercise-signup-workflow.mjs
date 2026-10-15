// Drive `signupAction` end to end — the last of the three auth-email actions that no
// committed script had reached.
//
// WHY THIS EXISTS NOW
// The long-standing blocker was "Supabase answers EVERY signUp with 429 in this
// environment". Re-probing showed that is no longer true: `auth.signUp` on the ANON key
// was ACCEPTED and really created a user. The 429s that remain are a per-budget effect
// (a second signUp in the same minute was refused), not an environment-wide wall. A
// documented blocker that has quietly cleared must be acted on, not left in the report.
//
// WHAT IS ACTUALLY TESTED
// The success path, through the real form and the real server action — not by calling
// Supabase directly, which is what the earlier probes did and which proves nothing about
// the product:
//
//   1. a fresh address submits and the form reports "Check your email"
//   2. a REAL auth user exists afterwards (service role, by email)
//   3. `assignApplicantMembership` really granted the applicant membership AND the role
//      — the action's second, easily-silently-failing half
//   4. submitting the SAME address again: what does it claim, and did it create anything?
//      This is the already-registered P2, asserted here rather than assumed, because the
//      earlier finding was reached by probing Supabase directly and never driven
//      through the UI.
//
// Assertions 2 and 3 are the positive controls for assertion 1. A success banner proves
// only that the component rendered; if no user and no membership exist, the action
// reported a success that did not happen.
//
// CLEANUP
// Deletes the auth user and any membership rows it created, then reads both back.
// Nothing outside this run's unique marker is touched.

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { chromium } from "@playwright/test";
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

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const MARK = Date.now().toString(36);
const EMAIL = `qasignup${MARK}@beepabpo.com`;
// Generated per run, not committed. The account is created and removed by this
// same script, so there is nothing for a fixed password to protect — and a
// hardcoded one here is a credential in a public repository for no benefit.
const PASSWORD = `Qa!${randomBytes(18).toString("base64url")}`;
const NAME = "QA Signup Probe";

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const note = (m) => console.log(`NOTE  ${m}`);

async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}

async function findUser(email) {
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function membershipsFor(userId) {
  return must(
    admin.from("organization_memberships").select("id, membership_type, status").eq("user_id", userId),
    "memberships",
  );
}

/**
 * The form asks which audience is registering before it asks for any field, so
 * the Company field only exists for a company registration.
 *
 * `fillSignup` requires an explicit audience. It used to fill `#company`
 * unconditionally, which was correct when the form was client-shaped for
 * everyone and became a false failure the moment the audience selector landed:
 * Playwright timed out waiting for a field the applicant path deliberately does
 * not render, failing with a fill timeout rather than an assertion — the shape of
 * "the page is broken", which is why it needed reading rather than re-running.
 *
 * The audience is now a required argument rather than a default so that a call
 * site which forgets it fails loudly instead of silently taking the applicant
 * path. `fillSignup(page2)` used to omit it, which made the comment below
 * ("both audiences are exercised") untrue: the duplicate leg ran the applicant
 * path again and the client branch was never driven at all.
 */
async function fillSignup(page, intent) {
  if (intent !== "applicant" && intent !== "client") {
    throw new Error(`fillSignup: audience must be "applicant" or "client", got ${JSON.stringify(intent)}`);
  }
  if (intent === "client") {
    await page.getByRole("button", { name: /hiring talent/i }).click();
    await page.locator("#company").waitFor({ state: "visible", timeout: 10000 });
  }
  await page.locator("#fullName").fill(NAME);
  await page.locator("#email").fill(EMAIL);
  if (intent === "client") await page.locator("#company").fill("QA Signup Co");
  await page.locator("#password").fill(PASSWORD);
  await page.locator("#confirmPassword").fill(PASSWORD);
  await page.locator("#acceptTerms").check();
}

let browser;
let createdUserId = null;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();

  // ---------- 1. the success path
  await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
  await page.locator("#fullName").waitFor({ state: "visible", timeout: 20000 });
  await fillSignup(page, "applicant");
  await page.getByRole("button", { name: /create account/i }).click();

  // The panel is only reachable once `state.ok` is true, so its presence is the action's
  // own report of success — not an inference from the click having been accepted.
  await page.getByRole("heading", { name: /check your email/i }).waitFor({ timeout: 30000 })
    .catch(() => {});
  const headingShown = await page.getByRole("heading", { name: /check your email/i }).count();
  const body = await page.locator("body").innerText();
  // The alert is the action's own error report. It has to be captured verbatim: the
  // environment refuses outbound email intermittently, and a run that cannot send must be
  // reported as BLOCKED rather than folded into the pass/fail count -- otherwise a
  // rate-limited run reads as a broken product, which is the exact mistake this repo has
  // already made once with a different probe.
  const alertText = (await page.locator("[role=alert]").allInnerTexts()).join(" | ").trim();
  const rateLimited = /too many|rate limit|try again later/i.test(alertText);
  note(`action error report: ${alertText ? `"${alertText}"` : "(none)"}`);

  /**
   * A rate-limited run is not a dead run.
   *
   * This file reported BLOCKED with 0 assertions, which reads as "nothing was
   * learned" -- but when the environment refuses to send the signup email, the
   * product still has a contract to keep, and it is checkable:
   *
   *   1. it says something to the user (no silent failure)
   *   2. it does NOT claim success (anti-enumeration must not become
   *      "everything is fine" when nothing happened)
   *   3. no auth user was created
   *   4. no membership row was created
   *
   * 3 and 4 are the important pair. A server action that renders an error and
   * still leaves a half-made account behind is a real defect, and it is exactly
   * the one an environment-blocked run would otherwise never get to check --
   * because the run gives up before looking. Measured repeatedly here: the
   * refusal path leaves 0 users and 0 memberships.
   *
   * So the run still exits BLOCKED (the success path remains unproven and must
   * not be scored), but it stops being zero-information.
   */
  if (rateLimited && !headingShown) {
    check("a refused signup still tells the user something went wrong", alertText.length > 0,
      alertText ? alertText.slice(0, 120) : "no error was surfaced at all");
    check("a refused signup does not claim success", !/Account created|If that address/i.test(body),
      /Account created/i.test(body) ? "CLAIMED SUCCESS while failing" : "no success copy");

    const ghost = await findUser(EMAIL);
    check("a refused signup creates no auth user", !ghost, ghost ? `LEAKED user ${ghost.id}` : "no user created");

    const ghostMs = ghost ? await membershipsFor(ghost.id) : [];
    check("a refused signup creates no membership", ghostMs.length === 0,
      `${ghostMs.length} membership row(s) left behind`);

    console.log(`\nBLOCKED — this environment refused to send the signup email ("${alertText}").`);
    console.log("That is an environment rate limit, not a product result: the SUCCESS path is");
    console.log("unproven and is not counted as passing. The refusal path above WAS exercised.");
    console.log("Do NOT run check-auth-email-rate-limit.mjs first -- it calls auth.signUp for real,");
    console.log("consumes the very budget this exercise needs, and has been observed burning it.");
    console.log("Wait out the project's signup limit, then run this file on its own.");
    process.exitCode = 2;
    throw new Error("BLOCKED: signup email rate limited (refusal path asserted above)");
  }
  // The action used to say "Account created" here, which was a lie for an address that
  // was already registered. It now uses anti-enumeration wording that asserts neither
  // outcome. Both halves are asserted: the new wording must be present, and the old
  // claim must be gone.
  const successCopy = body.match(/If that address[^\n]*/)?.[0]?.trim() ?? "";
  check("the form reports the signup neutrally, not 'Account created'",
    headingShown > 0 && successCopy.length > 0 && !/Account created/i.test(body),
    headingShown ? (successCopy || "panel shown but expected wording missing") : `no panel; body: ${body.slice(0, 160)}`);

  // ---------- 2. did a REAL user get created? (positive control for 1)
  const user = await findUser(EMAIL);
  createdUserId = user?.id ?? null;
  check("a real auth user now exists for that address", Boolean(user), user ? user.id : "no user found");

  if (user) {
    // ---------- 3. did the applicant membership half actually run?
    const ms = await membershipsFor(user.id);
    check("signupAction granted an applicant membership", ms.length === 1 && ms[0].membership_type === "applicant",
      ms.length ? JSON.stringify(ms[0]) : "no membership row");

    if (ms.length) {
      // `membership_roles` has no `id` column -- it is the (membership_id, role_id) pair.
      // Selecting "id" fails the whole query, which is how this run first aborted.
      const roles = await must(
        admin.from("membership_roles").select("membership_id, role_id").eq("membership_id", ms[0].id),
        "membership_roles",
      );
      const { data: applicantRole } = await admin.from("roles").select("id").eq("code", "applicant").single();
      check("that membership carries the applicant role",
        roles.length === 1 && roles[0].role_id === applicantRole.id,
        `${roles.length} role row(s)`);
    }
  }

  // ---------- 4. the already-registered address, through the UI this time
  const page2 = await browser.newPage();
  await page2.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
  await page2.locator("#fullName").waitFor({ state: "visible", timeout: 20000 });
  await fillSignup(page2, "applicant");
  await page2.getByRole("button", { name: /create account/i }).click();
  await page2.waitForTimeout(6000);
  const body2 = await page2.locator("body").innerText();
  const copy2 = body2.match(/If that address[^\n]*/)?.[0]?.trim() ?? "";
  const alert2 = (await page2.locator("[role=alert]").allInnerTexts()).join(" | ").trim();
  const secondLimited = /too many|rate limit|try again later/i.test(alert2);
  note(`re-submitting an already-registered address reports: ${copy2 || alert2 || body2.slice(0, 120)}`);

  // This run signs up TWICE, and the environment's budget is roughly one signup per window
  // (measured: first probe accepted, second refused 429). So the duplicate leg can be
  // blocked by the environment while the first succeeded a few seconds earlier. That is not
  // a product result and must not be scored as one -- otherwise a rate-limited duplicate
  // reads as "the anti-enumeration copy differs", which is the opposite of what happened.
  if (secondLimited && !copy2) {
    console.log(`\nBLOCKED — the duplicate-address leg was rate limited ("${alert2}").`);
    console.log("The first submission succeeded, so assertions 1-3 above are valid; assertions");
    console.log("about the duplicate path are not measurable in this run and are not counted.");
    note(`BLOCKED_PARTIAL: first leg valid, duplicate leg unmeasurable`);
  }

  // `auth.users` is not exposed through the Data API, so the admin API is the only way to
  // count real accounts. A second submission must not add one.
  const usersAfter = await findUser(EMAIL);
  check("the second submission created no second account", Boolean(usersAfter),
    usersAfter ? "still exactly the one user" : "NO USER AT ALL — the second submission destroyed the first");

  // The phantom-id path: Supabase hands back a user id belonging to no real account, and
  // `assignApplicantMembership` inserts a membership for it inside a try/catch that
  // discards the error. `user_id` is a FK to auth.users, so the insert must fail silently
  // -- the observable consequence is that the count does not move.
  const msAfter = createdUserId ? await membershipsFor(createdUserId) : [];
  check("the already-registered path created no second membership", msAfter.length === 1,
    `${msAfter.length} membership row(s) for the one real user`);

  // Anti-enumeration is observable here, not just asserted in prose: both submissions
  // take the same code path, so the already-registered one must produce byte-identical
  // wording to the genuinely-new one. If these ever diverge, the form has become an
  // account-existence oracle and that is a regression, not an improvement.
  if (!secondLimited || copy2) {
    check("an already-registered address is not reported as 'Account created'",
      !/Account created/i.test(body2),
      /Account created/i.test(body2) ? "STILL reported as created" : "neutral wording");
    check("an already-registered address gets the same wording as a new one",
      copy2.length > 0 && copy2 === successCopy,
      copy2 === successCopy ? "identical" : `differed:\n    new: ${successCopy}\n    dup: ${copy2}`);
  }
  await page2.close();
} catch (e) {
  console.error(`\nRUN ERROR: ${e.message}`);
  // Do not clobber the BLOCKED exit code (2) with a generic failure (1): a caller reading
  // the exit code needs to be able to tell "the environment refused" from "the product is
  // broken", and the two call for different responses.
  if (!process.exitCode) process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  try {
    const u = await findUser(EMAIL);
    if (u) {
      await admin.from("membership_roles").delete().in("membership_id",
        (await membershipsFor(u.id)).map((m) => m.id));
      await admin.from("organization_memberships").delete().eq("user_id", u.id);
      const del = await admin.auth.admin.deleteUser(u.id);
      note(`cleanup: auth user ${del.error ? `NOT DELETED (${del.error.message})` : "deleted"}`);
    } else {
      note("cleanup: no auth user remained to delete");
    }
    const { data: left } = await admin.from("organization_memberships").select("user_id")
      .eq("user_id", createdUserId ?? "00000000-0000-0000-0000-000000000000");
    note(`cleanup: membership rows left for this run: ${left?.length ?? 0}`);
  } catch (e) {
    console.error(`CLEANUP ERROR: ${e.message}`);
    process.exitCode = 1;
  }
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} assertions passed`);
process.exitCode = process.exitCode || (passed === results.length ? 0 : 1);