// Exercise `inviteClientUser` end to end through the real UI.
//
// WHY: this is the last of 83 server actions that had never been driven. It was
// BLOCKED, not failed — `admin.inviteUserByEmail` returns HTTP 429 for the
// environment's outbound email budget. That is not a property of the codebase,
// and the honest response to a blocker that lifts on a timer is to keep
// re-probing rather than to write it down once. `qa-probe-invite-domains.mjs`
// confirmed the apex domain is currently accepted, so the action is drivable and
// leaving it uncovered would be choosing not to look.
//
// THE REAL ASSERTION IS THE BUTTON, NOT THE ACTION. Calling the server action
// from a test would prove the action works. This drives the rendered form on
// /app/clients, which is what also proves the form is wired to it, the schema
// accepts the input, the select defaults to a real client organization, and the
// toast reports success.
//
// IDENTITY DISCIPLINE: the membership's `organization_id` is only ever compared
// against the organization id read from the form's own select, and `user_id`
// only against the auth user's id. Comparing an id across entity types is what
// caused two near-data-loss incidents in this project; there is no version of
// this script that needs to do that.
//
// SAFETY / CLEANUP: every row is addressed by a unique `qa-invite-` marker
// captured from the auth user this run created — never by a remembered list —
// and the cleanup result is a counted assertion, not a log line. A run killed
// before cleanup is recoverable by grepping the same prefix.
//
// EXIT: 0 pass, 1 fail, 2 BLOCKED (the environment's email budget closed again
// between the probe and this run — which is a legitimate outcome, not a defect,
// and must not be reported as one).
//
// Usage: node scripts/audit/qa-exercise-client-invite.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
const OWNER = "owner@demo.beepabpo.com";
const MARKER = `qa-invite-${Date.now().toString(36)}`;
const EMAIL = `${MARKER}@beepabpo.com`;

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const note = (m) => console.log(`NOTE  ${m}`);
const block = (m) => { console.log(`BLOCKED  ${m}`); };

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}

let createdUserId = null;
let createdMembershipId = null;

// ---- cleanup runs in a finally so a thrown assertion cannot leak -----------
async function cleanup() {
  const steps = [];
  if (createdMembershipId) {
    const roles = await must(
      db.from("membership_roles").select("id").eq("membership_id", createdMembershipId),
      "read membership_roles",
    );
    if (roles.length) {
      const del = await db.from("membership_roles").delete().in("id", roles.map((r) => r.id));
      steps.push(`membership_roles:${del.error ? "ERR " + del.error.message : `deleted ${roles.length}`}`);
    } else steps.push("membership_roles:none");
    const delMem = await db.from("organization_memberships").delete().eq("id", createdMembershipId);
    steps.push(`membership:${delMem.error ? "ERR " + delMem.error.message : "deleted"}`);
  }
  if (createdUserId) {
    const delProfile = await db.from("profiles").delete().eq("id", createdUserId);
    steps.push(`profile:${delProfile.error ? "ERR " + delProfile.error.message : "deleted"}`);
    const delUser = await db.auth.admin.deleteUser(createdUserId);
    steps.push(`auth_user:${delUser.error ? "ERR " + delUser.error.message : "deleted"}`);
  }
  console.log("cleanup: " + steps.join(" | "));
  return steps.every((s) => !s.includes("ERR"));
}

const browser = await chromium.launch();
let outcome = "pass";
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // ---- sign in ------------------------------------------------------------
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("input[type=email]").first().waitFor({ state: "visible", timeout: 20000 });
  await page.locator("input[type=email]").first().fill(OWNER);
  await page.locator("input[type=password]").first().fill(env.DEMO_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForFunction(() => !location.pathname.includes("/login"), null, { timeout: 25000 });
  await page.waitForTimeout(1200);

  // ---- reach the form ------------------------------------------------------
  await page.goto(`${BASE}/app/clients`, { waitUntil: "domcontentloaded" });
  const orgSelect = page.locator("#client-org");
  const formPresent = (await orgSelect.count()) === 1;
  check("the client invite form renders on /app/clients", formPresent);
  if (!formPresent) throw new Error("no invite form — clients.manage may be missing for owner");

  const orgOptions = await orgSelect.locator("option").evaluateAll((els) =>
    els.map((e) => ({ value: e.value, label: (e.textContent || "").trim() })),
  );
  check("the form offers at least one active client organization", orgOptions.length > 0,
    orgOptions.map((o) => o.label).join(", ").slice(0, 80));

  // Read the SELECTED organization id from the DOM. This is the value the action
  // will be handed, so it is the only thing the membership may be compared to.
  const selectedOrgId = await orgSelect.inputValue();
  check("an organization is selected by default", !!selectedOrgId, `org ${selectedOrgId}`);

  // ---- fill and submit -----------------------------------------------------
  await page.fill("#client-first-name", "Qa");
  await page.fill("#client-last-name", "Invitee");
  await page.fill("#client-email", EMAIL);
  const typedEmail = await page.inputValue("#client-email");
  check("the form accepts the invite address", typedEmail === EMAIL, typedEmail);

  await page.click('form button[type="submit"]');

  // The outcome is the toast host's child, not a body slice: the toast host
  // carries role=alert itself and is empty when no toast fired.
  const toastText = await page
    .waitForFunction(() => {
      const host = document.querySelector("[data-sonner-toaster]");
      const t = host?.innerText?.trim();
      return t && t.length > 0 ? t : null;
    }, null, { timeout: 45000 })
    .then((h) => h.jsonValue())
    .catch(() => null);

  const failed = !toastText || /unable|error|rate limit|invalid|failed|expired|not configured|select a client/i.test(toastText);
  if (failed) {
    // Distinguish "the environment refused to send mail" from "the feature is
    // broken". Only the first is a legitimate blocker.
    if (/rate limit|too many|email/i.test(toastText ?? "") && /rate|limit|quota/i.test(toastText ?? "")) {
      outcome = "blocked";
      block(`invite refused by the environment: "${toastText}"`);
    }
    check("invite succeeds", false, `toast: ${toastText ?? "(none)"}`);
    throw new Error("invite did not succeed");
  }
  check("invite succeeds", true, toastText.slice(0, 90));

  // ---- what the action must have written ----------------------------------
  const listed = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const authUser = listed.data?.users?.find((u) => u.email === EMAIL);
  createdUserId = authUser?.id ?? null;
  check("an auth user was created for the invited address", !!authUser, authUser?.id ?? "not found");

  const profiles = await must(
    db.from("profiles").select("id, display_name, first_name, last_name, status").eq("id", createdUserId),
    "read profile",
  );
  check("the profile carries the names typed into the form",
    profiles.length === 1 && profiles[0].display_name === "Qa Invitee",
    JSON.stringify(profiles[0] ?? null).slice(0, 120));

  const memberships = await must(
    db.from("organization_memberships")
      .select("id, organization_id, user_id, membership_type, status, is_primary")
      .eq("user_id", createdUserId),
    "read membership",
  );
  createdMembershipId = memberships[0]?.id ?? null;
  check("a membership was created", memberships.length === 1, `${memberships.length} row(s)`);

  const m = memberships[0] ?? {};
  // organization_id compared ONLY to the org id the form selected.
  check("the membership points at the organization the form selected",
    m.organization_id === selectedOrgId, `${m.organization_id} vs selected ${selectedOrgId}`);
  check("the membership belongs to the invited user", m.user_id === createdUserId);
  check("the membership is a client membership, not an internal one", m.membership_type === "client",
    String(m.membership_type));
  check("an invited user is marked invited, not active", m.status === "invited", String(m.status));

  const roles = await must(
    db.from("membership_roles").select("role_id, roles (id, code, scope)").eq("membership_id", createdMembershipId),
    "read membership_roles",
  );
  const roleCodes = roles.map((r) => r.roles?.code).filter(Boolean);
  check("the membership carries the client_admin portal role",
    roleCodes.includes("client_admin"), roleCodes.join(", ") || "none");
  check("the granted role is client-scoped", roles.every((r) => r.roles?.scope === "client"),
    roles.map((r) => r.roles?.scope).join(", "));

  // ---- an invited user must NOT be able to sign in yet ---------------------
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const signIn = await anon.auth.signInWithPassword({ email: EMAIL, password: env.DEMO_PASSWORD });
  check("the invited user cannot sign in with a password before accepting", !!signIn.error,
    signIn.error ? signIn.error.message : "SIGNED IN — invited users should have no password yet");

  await ctx.close();
} catch (err) {
  if (outcome !== "blocked") {
    check("the exercise ran to completion", false, String(err?.message ?? err).slice(0, 160));
    outcome = "fail";
  }
} finally {
  await browser.close();
}

// ---- cleanup is a RESULT, not a log line ----------------------------------
const cleaned = await cleanup();

// Verify by the marker, independently of the delete calls that just ran.
const leftovers = await must(
  db.from("organization_memberships").select("id").eq("user_id", createdUserId ?? "00000000-0000-0000-0000-000000000000"),
  "verify membership gone",
);
const stillThere = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
const ghost = stillThere.data?.users?.find((u) => u.email === EMAIL);
check("cleanup left no membership behind", leftovers.length === 0, `${leftovers.length} row(s)`);
check("cleanup removed the invited auth user", !ghost, ghost ? ghost.id : "gone");

const total = results.length;
const passed = results.filter((r) => r.pass).length;
const failures = results.filter((r) => !r.pass).length;

mkdirSync("docs/evidence", { recursive: true });
writeFileSync(
  "docs/evidence/client-invite-check.json",
  JSON.stringify(
    {
      check: "client-invite",
      generatedAt: new Date().toISOString(),
      base: BASE,
      marker: MARKER,
      total,
      passed,
      failures,
      blocked: outcome === "blocked",
      cleanupVerified: cleaned,
      results,
    },
    null,
    2,
  ) + "\n",
);

console.log(`\n${passed}/${total} passed`);
if (outcome === "blocked") {
  console.log("BLOCKED: the environment's email budget closed again. Re-run later.");
  process.exit(2);
}
process.exit(failures > 0 ? 1 : 0);