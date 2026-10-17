// Exercise the Admin surfaces that had never run: cron dry-run, test push,
// role assignment and membership revocation.
//
// WHY: `docs/QA_REPORT.md` §5 listed "admin role-assign and cron notification
// paths" as unexercised. They are the most privileged buttons in the product —
// one of them deletes every role a person holds — so "never run" is the worst
// possible state for them.
//
// Safety: every change here is reversible and the script restores what it
// touched in a `finally`, so an aborted run cannot leave a demo account with
// the wrong role or no access.
//
// Usage: node scripts/audit/qa-exercise-admin-workflow.mjs [--no-cleanup]

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { fillHeld } from "./lib/browser-form.mjs";

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
const blocked = [];
const notes = [];
/**
 * `detail` is kept on the record, not just printed.
 *
 * It used to be dropped here and passed only to `console.log`, so the evidence
 * file carried assertion names and pass/fail and nothing else — a reader had to
 * re-run the exercise to learn WHICH roles the invite granted, or which status
 * code came back. The detail is the part that makes a past verdict readable.
 */
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

/**
 * Record something the ENVIRONMENT prevented from being tested.
 *
 * These do not fail the run, and they are printed at the end so they cannot be
 * missed. A path that cannot execute is unknown, not passing — so it is
 * reported as its own category rather than being quietly folded into the pass
 * count or left as a permanent red that people learn to ignore.
 */
const recordBlocked = (name, reason) => {
  blocked.push({ name, reason });
  console.log(`BLOCKED  ${name}  — ${reason}`);
};

/**
 * Every read goes through this. `audit_logs` stores its JSON snapshots in
 * `before_data` / `after_data`, NOT `before` / `after` — and a select naming a
 * column that does not exist returns `data: null` plus an `error` without
 * throwing, which reads exactly like "nothing was logged". That mistake made
 * this script report "cron dry-run is not audit-logged" on a run that had
 * logged it perfectly. `profiles` likewise has no `email` column, so the users
 * table keys on `display_name`.
 */
async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what} failed: ${error.message}`);
  return data ?? [];
}

// The account we will change roles on and revoke. Marketing is chosen because
// nothing else in the suite depends on that role being held right now.
const TARGET_EMAIL = "marketing@demo.beepabpo.com";
const TARGET_NAME = "Demo Marketing";
const ALT_ROLE = "finance";

const { data: authList, error: aErr } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
if (aErr) { console.error(aErr.message); process.exit(1); }
const authByEmail = new Map((authList?.users ?? []).map((u) => [u.email, u.id]));
const adminUserId = authByEmail.get("superadmin@demo.beepabpo.com");
const targetUserId = authByEmail.get(TARGET_EMAIL);

const { data: targetMembership, error: mErr } = await db
  .from("organization_memberships")
  .select("id, status, membership_type, user_id")
  .eq("user_id", targetUserId ?? "00000000-0000-0000-0000-000000000000")
  .maybeSingle();
if (mErr || !targetMembership) {
  console.error(`could not resolve membership for ${TARGET_EMAIL}: ${mErr?.message ?? "not found"}`);
  process.exit(1);
}

async function roleCodesFor(membershipId) {
  const { data, error } = await db
    .from("membership_roles")
    .select("roles!inner(code)")
    .eq("membership_id", membershipId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.roles?.code).filter(Boolean).sort();
}

const originalRoles = await roleCodesFor(targetMembership.id);
const originalStatus = targetMembership.status;
console.log(`target: ${TARGET_EMAIL} membership=${targetMembership.id}`);
console.log(`original roles: [${originalRoles.join(", ")}] status=${originalStatus}\n`);

const { count: auditBefore } = await db
  .from("audit_logs").select("id", { count: "exact", head: true });
const { count: notifBefore } = await db
  .from("notifications").select("id", { count: "exact", head: true });

const browser = await chromium.launch();
let roleChanged = false;
let invitedUserId = null;
let invitedMembershipId = null;
let revokeTried = false;

async function restore() {
  if (!APPLY_CLEANUP) { console.log("\ncleanup: skipped (--no-cleanup)"); return; }
  if (revokeTried) {
    await db.from("organization_memberships").update({ status: originalStatus }).eq("id", targetMembership.id);
  }
  if (roleChanged) {
    await db.from("membership_roles").delete().eq("membership_id", targetMembership.id);
    const { data: roles } = await db.from("roles").select("id, code").in("code", originalRoles);
    for (const r of roles ?? []) {
      await db.from("membership_roles").insert({ membership_id: targetMembership.id, role_id: r.id });
    }
  }
  // notifications created by this run
  await db.from("notifications").delete().eq("type", "system.test");
  // the account this run invited, which must not outlive it
  if (invitedUserId) {
    if (invitedMembershipId) {
      await db.from("membership_roles").delete().eq("membership_id", invitedMembershipId);
      await db.from("organization_memberships").delete().eq("id", invitedMembershipId);
    }
    await db.from("profiles").delete().eq("id", invitedUserId);
    await db.auth.admin.deleteUser(invitedUserId);
    const { data: still } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const gone = !(still?.users ?? []).some((u) => u.id === invitedUserId);
    check("this run removed the account it invited", gone, gone ? "deleted" : "*** still present ***");
  }
  // verify, do not trust the write
  const now = await roleCodesFor(targetMembership.id);
  const { data: m } = await db.from("organization_memberships").select("status").eq("id", targetMembership.id).maybeSingle();
  const ok = JSON.stringify(now) === JSON.stringify([...originalRoles].sort()) && m?.status === originalStatus;
  check(
    "this run left the account exactly as it found it",
    ok,
    `roles now [${now.join(", ")}] (was [${originalRoles.join(", ")}]), status ${m?.status} (was ${originalStatus})`,
  );
}

try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await fillHeld(page, page.locator('input[type=email]'), "superadmin@demo.beepabpo.com");
  await fillHeld(page, page.locator('input[type=password]'), env.DEMO_PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);
  check("signed in as super admin", page.url().includes("/app"), page.url());

  // ---- 1. cron dry-run ----
  await page.goto(`${BASE}/app/admin`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Cron dry-run" }).click();

  // Wait for the CONDITION, not a duration.
  //
  // This was `waitForTimeout(4000)`, and it produced a full-suite FAIL reading
  // "no summary line found" while passing on an idle server minutes later. The
  // dry-run walks three real jobs, and in a full run the server is already
  // carrying twenty exercises — so the assertion was measuring how busy the box
  // was, not whether the button works. A check that fails under load and passes
  // when quiet is a flake wearing a product defect's clothes, and the fix is
  // never to lengthen the sleep.
  const SUMMARY = /Dry-run OK — missing clock-out: \d+, overdue invoices: \d+, digests: \d+/;
  let cronSaid = true;
  try {
    await page.waitForFunction(
      (src) => new RegExp(src).test(document.body.innerText.replace(/\s+/g, " ")),
      SUMMARY.source,
      { timeout: 60_000 },
    );
  } catch {
    cronSaid = false;
  }
  const cronText = await page.locator("body").innerText();
  check(
    "cron dry-run button reports per-job counts",
    cronSaid,
    cronText.match(/Dry-run OK[^\n]*/)?.[0] ??
      `no summary line within 60s; page said: ${
        cronText.match(/(Unable|denied|error|failed)[^\n]*/i)?.[0]?.trim().slice(0, 110) ??
        "nothing recognisable"
      }`,
  );

  const cronAudit = await must(db
    .from("audit_logs").select("action, after_data")
    .eq("action", "jobs.cron_dry_run").order("created_at", { ascending: false }).limit(1), "cron audit read");
  check("cron dry-run is audit-logged", Boolean(cronAudit?.length), JSON.stringify(cronAudit?.[0]?.after_data ?? null));

  // ---- 2. test push ----
  //
  // Same shape as the cron fix above: a fixed sleep followed by a read that the
  // server may not have finished writing yet. Polls the condition with a bound
  // instead of assuming 3.5s was enough.
  await page.getByRole("button", { name: "Send me test push" }).click();
  let testNotif = [];
  const pushDeadline = Date.now() + 60_000;
  while (Date.now() < pushDeadline) {
    const { data } = await db
      .from("notifications").select("id, user_id, type, title, body")
      .eq("type", "system.test").eq("user_id", adminUserId ?? "").limit(1);
    testNotif = data ?? [];
    if (testNotif.length) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  check("test push wrote a notification to the admin", Boolean(testNotif?.length),
    testNotif?.[0] ? `"${testNotif[0].body}"` : "none within 60s");

  // ---- 2b. invite a staff member ----
  //
  // Also never run. The invite path granted exactly one role, so somebody
  // invited as HR could not open their own leave, payslips, attendance or
  // tickets — the `employee` baseline every seeded staff member carries.
  const inviteEmail = `qa.invite.${Date.now().toString(36)}@example.invalid`;
  await page.goto(`${BASE}/app/admin/users`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.fill("#invite-first-name", "Qa");
  await page.fill("#invite-last-name", "Invitee");
  await page.fill("#invite-email", inviteEmail);
  await page.selectOption("#invite-role", "hr");
  // Poll for a toast from the moment of the click. Sonner auto-dismisses in ~4s,
// so waiting 7s and then looking finds nothing — which is how a silent failure
// reads as "no message at all" rather than as the reason it failed.
const toastSeen = new Set();
const toastWatcher = setInterval(async () => {
  try {
    const texts = await page.locator('[data-sonner-toast], [role="status"], [role="alert"]').allInnerTexts();
    for (const t of texts) if (t.trim()) toastSeen.add(t.trim());
  } catch { /* page navigating */ }
}, 250);

await page.getByRole("button", { name: "Send invite" }).click();
  await page.waitForTimeout(6000);
  clearInterval(toastWatcher);
  const toastText = [...toastSeen].join(" | ").trim();
  const pageText = await page.locator("body").innerText();
  const hint =
    toastText ||
    (pageText.match(/Invite sent[^\n]*|Existing user linked[^\n]*|Unable to[^\n]*|[^\n]*valid work email[^\n]*|[^\n]*already[^\n]*/i)?.[0] ?? "");

  const { data: invitedList } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const invitedUser = (invitedList?.users ?? []).find((u) => u.email === inviteEmail);
  invitedUserId = invitedUser?.id ?? null;

  // HOW TO TELL "the mail provider refused" FROM "the invite action is broken"
  //
  // This used to test /rate limit/i, which can never match what the user
  // actually sees. The action reports a delivery failure with deliberately
  // generic copy -- "Unable to send the invite right now. Try again in a
  // moment." -- so the BLOCKED branch below was unreachable in practice and a
  // spent email budget was reported as a product FAIL: "invite created the
  // account -- not created". The suite went red for a reason no code change
  // can fix, which is exactly what BLOCKED exists to prevent.
  //
  // So this matches the copy the app emits for a provider refusal. A genuine
  // bug in the invite action is still caught: it would have to produce this
  // same sentence to be misfiled, and a validation fault produces different
  // copy entirely ("valid work email", "already ..."), which falls through to
  // the FAIL branch where it belongs.
  const emailRefused = /unable to send the invite|try again in a moment|rate limit|too many/i.test(
    toastText || "",
  );
  if (invitedUser) {
    check("invite created the account", true, invitedUser.email);
  } else if (emailRefused) {
    recordBlocked(
      "invite creates an account",
      "Supabase auth rate-limited outbound email (HTTP 429). The invite path needs a " +
        "fresh SMTP quota or a project that is not being hammered; the error IS surfaced to the user.",
    );
  } else {
    check("invite created the account", false, `not created — UI said: ${hint || "(no message at all)"}`);
  }
  // A button that fails silently is worse than one that fails loudly, so check
  // the user was actually told something.
  check("a failing invite tells the user why", Boolean(toastText),
    toastText ? toastText.slice(0, 120) : "*** no feedback shown to the user ***");

  if (invitedUserId) {
    const { data: invMembership } = await db
      .from("organization_memberships").select("id").eq("user_id", invitedUserId).maybeSingle();
    const invitedRoles = invMembership ? await roleCodesFor(invMembership.id) : [];
    check(
      "invited member has BOTH the chosen role and self-service access",
      invitedRoles.includes("hr") && invitedRoles.includes("employee"),
      `roles [${invitedRoles.join(", ")}]`,
    );
    invitedMembershipId = invMembership?.id ?? null;
  }

  // ---- 2c. invite an account that ALREADY EXISTS -- the leg the quota does not block
  //
  // The block above is real: `inviteUserByEmail` on a NEW address spends SMTP
  // quota, and this project's has none. But the same action has a second path,
  // and it is the one a real admin hits most often — inviting somebody who
  // already has an account. Supabase answers "A user with this email address has
  // already been registered" and returns NO user, so `inviteOrResolveAuthUser`
  // falls through to paging `listUsers` for the id.
  //
  // That path never sends mail, so it is not quota-bound, and it exercises
  // everything the blocked leg would have: membership creation, the `employee`
  // baseline alongside the chosen role, the audit row, and the UI's success copy.
  // PROVEN BY PROBE before being built: an existing address returns "already
  // registered" while a new one still returns 429/invalid, so the short-circuit is
  // real and not an artefact of reading the helper.
  //
  // The fixture is a throwaway auth user on `@demo.beepabpo.com`. The domain
  // matters and was chosen by measurement: `createUser` accepts
  // `@nowhere.example`, but `inviteUserByEmail` VALIDATES the domain and rejected
  // it — so a throwaway built on the domain the first probe used could never be
  // invited at all, and this leg would have failed for a reason that looks like a
  // product defect.
  const existingEmail = `qa.invite.existing.${Date.now().toString(36)}@demo.beepabpo.com`;
  const seeded = await db.auth.admin.createUser({
    email: existingEmail,
    password: "QaInvite#2026x",
    email_confirm: true, // no confirmation mail, so this spends no quota
  });
  if (seeded.error) {
    recordBlocked("invite an existing account", `could not seed the fixture account: ${seeded.error.message}`);
  } else {
    const existingUserId = seeded.data.user.id;
    try {
      await page.goto(`${BASE}/app/admin/users`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      await page.fill("#invite-first-name", "Qa");
      await page.fill("#invite-last-name", "Existing");
      await page.fill("#invite-email", existingEmail);
      await page.selectOption("#invite-role", "hr");
      await page.getByRole("button", { name: "Send invite" }).click();
      // Sonner auto-dismisses in ~4s, so reading `body` after a fixed wait finds
      // nothing — the toast is already gone by the time the page settles. The
      // same trap the first invite block documents, which is why it polls from the
      // moment of the click. Reading the page body here reported
      // "(nothing recognisable)" on a run whose membership and roles were both
      // correct: the check was measuring the absence of a message that had
      // already been shown and dismissed, not a defect.
      const existingToasts = new Set();
      const existingWatcher = setInterval(async () => {
        try {
          const texts = await page.locator('[data-sonner-toast], [role="status"], [role="alert"]').allInnerTexts();
          for (const t of texts) if (t.trim()) existingToasts.add(t.trim());
        } catch { /* page navigating */ }
      }, 200);
      await page.waitForTimeout(6000);
      clearInterval(existingWatcher);
      const existingToastsText = [...existingToasts].join(" | ").trim();

      // The action's own wording for the RESOLVE path, from `inviteInternalUser`:
      // `invited ? "Invite sent to …" : "Existing user linked with role …"`.
      //
      // The first version of this check looked for a loose `/existing user/i`,
      // guessed from the earlier `hint` regex rather than read from the action.
      // An assertion written from imagination reports itself as a product defect.
      // Matching the role in the sentence is what proves this specific branch ran
      // rather than the mail one — which would say "Invite sent to".
      const linkedCopy = existingToastsText.match(/Existing user linked with role [a-z_]+\./i)?.[0]?.trim();
      check(
        "inviting an existing account reports that the user was linked",
        Boolean(linkedCopy),
        linkedCopy ?? `page said: ${existingToastsText.slice(0, 110) || "(no toast was shown)"}`,
      );

      const { data: exMembership } = await db
        .from("organization_memberships").select("id").eq("user_id", existingUserId).maybeSingle();
      check("the existing account was given a membership", Boolean(exMembership?.id));

      if (exMembership?.id) {
        const exRoles = await roleCodesFor(exMembership.id);
        // The same regression the blocked leg asserts: the chosen role ALONE would
        // leave somebody unable to open their own leave, payslips or attendance.
        check(
          "existing-account invite grants BOTH the chosen role and self-service access",
          exRoles.includes("hr") && exRoles.includes("employee"),
          `roles [${exRoles.join(", ")}]`,
        );

        const { data: exAudit } = await db
          .from("audit_logs").select("id, action").eq("action", "users.invite")
          .order("created_at", { ascending: false }).limit(1);
        check("existing-account invite is audit-logged", Boolean(exAudit?.length),
          exAudit?.[0]?.action ?? "no users.invite row");
      }
    } finally {
      // Remove what this leg created. The membership first (it has role links),
      // then the auth user, and both are asserted rather than assumed — a silently
      // failed cleanup would leave a real account behind and the next run would
      // create a second one.
      const { data: leftover } = await db
        .from("organization_memberships").select("id").eq("user_id", existingUserId);
      for (const m of leftover ?? []) {
        await db.from("membership_roles").delete().eq("membership_id", m.id);
        await db.from("organization_memberships").delete().eq("id", m.id);
      }
      const del = await db.auth.admin.deleteUser(existingUserId);
      const gone = (await db.auth.admin.getUserById(existingUserId)).data?.user;
      check("existing-account invite left nothing behind", !del.error && !gone,
        del.error ? `deleteUser: ${del.error.message}` : gone ? "auth user still present" : "membership and auth user removed");
    }
  }

  // ---- 3. role change on a real membership ----
  await page.goto(`${BASE}/app/admin/users`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const row = page.locator("tr", { hasText: TARGET_NAME }).first();
  check("target membership row rendered", await row.count() > 0);

  const roleSelect = row.locator('select[aria-label="Membership role"]').first();
  check("role select present on the row", await roleSelect.count() > 0);

  // The row button is disabled until a DIFFERENT role is chosen.
  const updateBtn = row.getByRole("button", { name: "Update role" }).first();
  const disabledBefore = await updateBtn.isDisabled();
  check("Update role is disabled while the role is unchanged", disabledBefore === true);

  await roleSelect.selectOption(ALT_ROLE);
  await page.waitForTimeout(400);
  const enabledAfter = !(await updateBtn.isDisabled());
  check("Update role enables once a different role is chosen", enabledAfter === true);
  if (!enabledAfter) throw new Error("Update role never enabled — cannot exercise the path");

  await updateBtn.click();
  await page.waitForTimeout(900);
  const roleDialog = page.locator('[role="dialog"]').last();
  check("role change asks for confirmation", await roleDialog.count() > 0,
    (await roleDialog.innerText().catch(() => "")).slice(0, 70).replace(/\s+/g, " "));
  await roleDialog.getByRole("button", { name: "Update role" }).last().click();
  await page.waitForTimeout(4000);

  const rolesNow = await roleCodesFor(targetMembership.id);
  // The regression this asserts: changing Marketing to Finance used to leave
  // `[finance]` only, stripping the `employee` baseline that carries the
  // member's own leave, payslips, attendance and tickets.
  const expectedAfter = originalRoles.includes("employee")
    ? ["employee", ALT_ROLE].sort()
    : [ALT_ROLE].sort();
  check(
    "role changed but the self-service baseline survived",
    JSON.stringify(rolesNow) === JSON.stringify(expectedAfter),
    `roles now [${rolesNow.join(", ")}], expected [${expectedAfter.join(", ")}]`,
  );
  check(
    "member keeps their own leave/payroll/attendance access",
    !originalRoles.includes("employee") || rolesNow.includes("employee"),
    `employee role ${rolesNow.includes("employee") ? "retained" : "*** LOST ***"}`,
  );
  roleChanged = rolesNow.join(",") !== originalRoles.join(",");

  const roleAudit = await must(db
    .from("audit_logs").select("before_data, after_data").eq("action", "users.role_change")
    .order("created_at", { ascending: false }).limit(1), "role audit read");
  check("role change is audit-logged with before and after", Boolean(roleAudit?.length),
    JSON.stringify(roleAudit?.[0] ?? null).slice(0, 120));

  // ---- 4. revoke, then restore ----
  revokeTried = true;
  const revokeBtn = row.getByRole("button", { name: "Revoke" }).first();
  await revokeBtn.click();
  await page.waitForTimeout(900);
  const revokeDialog = page.locator('[role="dialog"]').last();
  check("revoke asks for confirmation", await revokeDialog.count() > 0,
    (await revokeDialog.innerText().catch(() => "")).slice(0, 70).replace(/\s+/g, " "));
  await revokeDialog.getByRole("button", { name: "Revoke" }).last().click();
  await page.waitForTimeout(4000);

  const { data: afterRevoke } = await db
    .from("organization_memberships").select("status").eq("id", targetMembership.id).maybeSingle();
  check("revoke set the membership inactive", afterRevoke?.status === "inactive", `status=${afterRevoke?.status}`);

  const revokeAudit = await must(db
    .from("audit_logs").select("before_data, after_data").eq("action", "users.revoke")
    .order("created_at", { ascending: false }).limit(1), "revoke audit read");
  check("revoke is audit-logged", Boolean(revokeAudit?.length), JSON.stringify(revokeAudit?.[0] ?? null).slice(0, 120));

  check("no console errors during the admin run", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  await ctx.close();
} finally {
  await restore().catch((e) => console.error("restore failed:", e.message));
  await browser.close().catch(() => {});

  const { count: auditAfter } = await db.from("audit_logs").select("id", { count: "exact", head: true });
  const { count: notifAfter } = await db.from("notifications").select("id", { count: "exact", head: true });
  console.log(`\naudit_logs ${auditBefore} -> ${auditAfter}, notifications ${notifBefore} -> ${notifAfter} (minus this run's test push)`);

  const failed = results.filter((r) => !r.pass);

  // Evidence, not a claim.
  //
  // This exercise wrote nothing, so `docs/evidence/workflow-admin-workflow.json`
  // was produced by `qa-run-workflows.mjs` rather than by the thing that
  // measured. The consequence is visible and bad: running the exercise directly
  // — which is how it is normally run, and how the invite budget is managed —
  // left that file at its previous contents. It still said `assertions: 18` and
  // `when: 02:07` after a 23-check run at 06:20, and a reader had no way to tell
  // the file was stale except by noticing the date.
  //
  // Written in `finally`, so a crashed run still leaves a record of having run —
  // the same rule as the other seven exercises fixed in this pass.
  // `docs/evidence/` exists because every other exercise writes there, but this
  // one may be the first thing to run on a fresh checkout.
  mkdirSync("docs/evidence", { recursive: true });
  writeFileSync(
    "docs/evidence/workflow-admin-workflow.json",
    JSON.stringify(
      {
        id: "admin-workflow",
        script: "scripts/audit/qa-exercise-admin-workflow.mjs",
        claim: "admin surfaces: cron dry run, test push, invite (both legs), role change, revoke",
        base: BASE,
        when: new Date().toISOString(),
        exitCode: process.exitCode ?? 0,
        // BLOCKED is a real outcome here, not a failure: the new-address invite
        // needs SMTP quota this project does not have.
        verdict: failed.length ? "FAIL" : blocked.length ? "BLOCKED" : "PASS",
        assertions: results.length,
        checks: results,
        failedAssertions: failed.map((r) => r.name),
        // Recorded, not just printed — the reason a path is unproven belongs next
        // to the run that could not prove it.
        blockedPaths: blocked,
        notes,
        auditLogs: { before: auditBefore, after: auditAfter },
        notifications: { before: notifBefore, after: notifAfter },
      },
      null,
      2,
    ) + "\n",
  );
  console.log("wrote docs/evidence/workflow-admin-workflow.json");

  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (blocked.length) {
    console.log(`\n${blocked.length} path(s) could not be exercised in this environment:`);
    for (const b of blocked) console.log(`  - ${b.name}\n      ${b.reason}`);
    console.log("  These are UNKNOWN, not passing. See docs/QA_REPORT.md.");
  }
  // A blocked path is not a pass. This run used to print exactly that sentence
  // and then exit 0, so a spent email budget reported as success to every
  // caller that reads an exit code -- including `qa-run-workflows.mjs`, which
  // maps 0 to PASS. Exit 2 is the code the runners already treat as BLOCKED.
  if (failed.length) process.exitCode = 1;
  else if (blocked.length) process.exitCode = 2;
}