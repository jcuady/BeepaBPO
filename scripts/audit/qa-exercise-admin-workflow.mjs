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
const APPLY_CLEANUP = !process.argv.includes("--no-cleanup");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const results = [];
const blocked = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
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
  await page.fill('input[type=email]', "superadmin@demo.beepabpo.com");
  await page.fill('input[type=password]', env.DEMO_PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);
  check("signed in as super admin", page.url().includes("/app"), page.url());

  // ---- 1. cron dry-run ----
  await page.goto(`${BASE}/app/admin`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Cron dry-run" }).click();
  await page.waitForTimeout(4000);
  const cronText = await page.locator("body").innerText();
  const cronSaid = /Dry-run OK — missing clock-out: \d+, overdue invoices: \d+, digests: \d+/.test(cronText);
  check("cron dry-run button reports per-job counts", cronSaid,
    cronText.match(/Dry-run OK[^\n]*/)?.[0] ?? "no summary line found");

  const cronAudit = await must(db
    .from("audit_logs").select("action, after_data")
    .eq("action", "jobs.cron_dry_run").order("created_at", { ascending: false }).limit(1), "cron audit read");
  check("cron dry-run is audit-logged", Boolean(cronAudit?.length), JSON.stringify(cronAudit?.[0]?.after_data ?? null));

  // ---- 2. test push ----
  await page.getByRole("button", { name: "Send me test push" }).click();
  await page.waitForTimeout(3500);
  const { data: testNotif } = await db
    .from("notifications").select("id, user_id, type, title, body")
    .eq("type", "system.test").eq("user_id", adminUserId ?? "").limit(1);
  check("test push wrote a notification to the admin", Boolean(testNotif?.length),
    testNotif?.[0] ? `"${testNotif[0].body}"` : "none");

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
  const rateLimited = /rate limit/i.test(toastText || "");
  if (invitedUser) {
    check("invite created the account", true, invitedUser.email);
  } else if (rateLimited) {
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
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (blocked.length) {
    console.log(`\n${blocked.length} path(s) could not be exercised in this environment:`);
    for (const b of blocked) console.log(`  - ${b.name}\n      ${b.reason}`);
    console.log("  These are UNKNOWN, not passing. See docs/QA_REPORT.md.");
  }
  if (failed.length) process.exitCode = 1;
}