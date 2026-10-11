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

  // Each step is wrapped independently. The previous version let one failure
  // abort the rest of the function, so a single bad read left ALL FOUR rows
  // behind -- which is exactly what happened: this selected `id` from
  // `membership_roles`, a column that does not exist, `must()` threw, and not
  // one delete ran. The eleven assertions above it had all passed.
  const step = async (label, fn) => {
    try {
      const res = await fn();
      steps.push(`${label}:${res.error ? "ERR " + res.error.message : res.ok ?? "done"}`);
      if (res.error) return false;
    } catch (err) {
      steps.push(`${label}:ERR ${String(err?.message ?? err).slice(0, 80)}`);
      return false;
    }
    return true;
  };

  if (createdMembershipId) {
    // `membership_roles` has no `id` column -- it is a join table keyed by
    // (membership_id, role_id). Delete straight by membership_id; reading rows
    // first is what introduced the crash.
    await step("membership_roles", () =>
      db.from("membership_roles").delete().eq("membership_id", createdMembershipId));
    await step("membership", () =>
      db.from("organization_memberships").delete().eq("id", createdMembershipId));
  }
  if (createdUserId) {
    await step("profile", () => db.from("profiles").delete().eq("id", createdUserId));
    await step("auth_user", async () => {
      const res = await db.auth.admin.deleteUser(createdUserId);
      return res.error ? { error: res.error } : { ok: true };
    });
  }
  console.log("cleanup: " + steps.join(" | "));
  const failed = steps.filter((s) => s.includes("ERR"));
  // Cleanup failure is a RESULT, not a log line. Silently leaving a QA account
  // and membership in the live database is the residue defect this report has
  // already fixed once in the product.
  if (failed.length) console.log(`cleanup reported ${failed.length} failed step(s)`);
  return failed.length === 0;
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

  // ------------------------------------------------------------------
  // Success is decided by STATE, never by the wording of the toast.
  //
  // This used to be a blacklist of failure words matched against the toast:
  // /unable|error|rate limit|invalid|failed|.../i. It worked only because the
  // product happened to surface GoTrue's raw string, which contains "rate
  // limit". When `inviteErrorMessage` replaced that with real copy — "Too many
  // invites have been sent from this network. Wait a moment, then try again." —
  // not one of those words matched, and this harness reported PASS on an invite
  // that had been refused outright.
  //
  // An improved error message turned a working detector into a silent one. The
  // lesson is that copy is not a signal: a check that has to be edited every
  // time someone improves the wording is measuring the wording.
  //
  // So the only question asked here is "did an account appear?", and the toast
  // is demoted to a detail printed alongside the verdict.
  // ------------------------------------------------------------------
  const listed = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const authUser = listed.data?.users?.find((u) => u.email === EMAIL);
  createdUserId = authUser?.id ?? null;

  if (!authUser) {
    // No account means the invite did not take effect, whatever the toast says.
    // Distinguish "the environment refused to send mail" from "the feature is
    // broken": only the first is a legitimate blocker.
    //
    // This list only ever CLASSIFIES a failure that state has already confirmed.
    // It can no longer manufacture a pass, which is the entire failure mode.
    const environmentRefused = /too many invites|rate limit|quota|couldn't reach the invite service/i
      .test(toastText ?? "");
    if (environmentRefused) {
      outcome = "blocked";
      block(`invite refused by the environment: "${toastText}"`);
    }
    check("invite succeeds", false,
      `no auth user was created — toast: ${toastText ?? "(none)"}`);
    throw new Error("invite did not succeed");
  }
  check("invite succeeds", true, `auth user ${authUser.id} — toast: ${toastText ?? "(no toast)"}`);
  check("an auth user was created for the invited address", true, authUser.id);

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
// A run that cannot clean up after itself has not passed, whatever its
// assertions said. Before this check, a cleanup that errored was still reported
// as a green run while leaving a real account and membership behind in the
// live database.
if (!cleaned) {
  console.log("FAIL: cleanup did not complete — this run left rows behind.");
  process.exit(1);
}
process.exit(failures > 0 ? 1 : 0);