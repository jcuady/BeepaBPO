// Exercise the recruitment hire pipeline end to end.
//
// WHY: `convertApplicantToEmployee` is the highest-consequence button in
// recruitment — it creates an employee record, rewrites an applicant's
// membership into an internal one, assigns roles, and flips the application to
// `hired`. It had never been run against live data.
//
// Uses the existing Demo Applicant, who already has a `profile_id`. That is
// deliberate: without one the action calls `inviteOrResolveAuthUser`, which
// sends an email, and Supabase rate-limits that in this environment — so the
// hire path could not be exercised at all.
//
// Everything it changes is snapshotted first and restored in a `finally`.
//
// Usage: node scripts/audit/qa-exercise-hire-workflow.mjs [--no-cleanup]

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
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}

// ---- resolve the target: Demo Applicant's application ----
const applicants = await must(db.from("applicants").select("id, profile_id, first_name, last_name, email"), "applicants");
const demoApplicant = applicants.find((a) => a.email === "applicant@demo.beepabpo.com");
if (!demoApplicant?.profile_id) {
  console.error("Demo Applicant not found, or has no profile_id — cannot exercise the hire path without sending an email");
  process.exit(1);
}
const apps = await must(
  db.from("job_applications").select("id, stage, applicant_id").eq("applicant_id", demoApplicant.id),
  "applications",
);
if (!apps.length) { console.error("Demo Applicant has no application"); process.exit(1); }
const app = apps[0];

const membership = (await must(
  db.from("organization_memberships")
    .select("id, status, membership_type, user_id")
    .eq("user_id", demoApplicant.profile_id).maybeSingle(), "membership",
))[0] ?? (await must(db.from("organization_memberships").select("id, status, membership_type, user_id").eq("user_id", demoApplicant.profile_id), "membership"))[0];

const originalMembershipRoles = await must(
  db.from("membership_roles").select("role_id, roles!inner(code)").eq("membership_id", membership.id),
  "membership_roles",
);
const originalCodes = originalMembershipRoles.map((r) => r.roles.code).sort();
const historyBefore = await must(
  db.from("application_stage_history").select("id").eq("job_application_id", app.id), "history",
);
const employeesBefore = await must(db.from("employees").select("id"), "employees");

console.log(`target: ${demoApplicant.first_name} ${demoApplicant.last_name}  application=${app.id}`);
console.log(`original: stage=${app.stage}  membership_type=${membership.membership_type} status=${membership.status} roles=[${originalCodes.join(",")}]`);

const browser = await chromium.launch();
let hired = false;

async function restore() {
  if (!APPLY_CLEANUP) { console.log("\ncleanup: skipped (--no-cleanup)"); return; }

  if (hired) {
    const created = await must(db.from("employees").select("id").eq("profile_id", demoApplicant.profile_id), "created employee");
    for (const e of created ?? []) await db.from("employees").delete().eq("id", e.id);
    // Restore the exact original role set. This used to only DELETE roles the run
    // added, which was wrong once the hire action itself started replacing the
    // applicant's role — the applicant role was gone afterwards and nothing put
    // it back, so a failed run silently left the account with no roles at all.
    const nowRoles = await must(db.from("membership_roles").select("role_id").eq("membership_id", membership.id), "roles now");
    await db.from("membership_roles").delete().eq("membership_id", membership.id);
    for (const r of originalMembershipRoles) {
      await db.from("membership_roles").insert({ membership_id: membership.id, role_id: r.role_id });
    }
    void nowRoles;
    await db.from("organization_memberships")
      .update({ membership_type: membership.membership_type, status: membership.status })
      .eq("id", membership.id);
    await db.from("job_applications").update({ stage: app.stage }).eq("id", app.id);
    const historyNow = await must(db.from("application_stage_history").select("id").eq("job_application_id", app.id), "history now");
    for (const h of historyNow) {
      if (!historyBefore.some((b) => b.id === h.id)) {
        await db.from("application_stage_history").delete().eq("id", h.id);
      }
    }
  }

  // verify by re-reading
  const finalRoles = (await must(db.from("membership_roles").select("roles!inner(code)").eq("membership_id", membership.id), "final roles"))
    .map((r) => r.roles.code).sort();
  const finalMembership = await must(db.from("organization_memberships").select("membership_type, status").eq("id", membership.id).maybeSingle(), "final membership");
  const finalApp = await must(db.from("job_applications").select("stage").eq("id", app.id).maybeSingle(), "final app");
  const finalEmployees = await must(db.from("employees").select("id"), "final employees");
  const ok =
    JSON.stringify(finalRoles) === JSON.stringify(originalCodes) &&
    finalMembership.membership_type === membership.membership_type &&
    finalMembership.status === membership.status &&
    finalApp.stage === app.stage &&
    finalEmployees.length === employeesBefore.length;
  check(
    "this run left recruitment exactly as it found it",
    ok,
    `roles [${finalRoles.join(",")}] (was [${originalCodes.join(",")}]), type=${finalMembership.membership_type}, status=${finalMembership.status}, stage=${finalApp.stage}, employees ${employeesBefore.length} -> ${finalEmployees.length}`,
  );
}

try {
  // Recruiter moves the stage; HR performs the hire. The Hire button requires
  // BOTH recruitment.manage and employees.manage, which only owner and hr hold.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type=email]', "hr@demo.beepabpo.com");
  await page.fill('input[type=password]', env.DEMO_PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);
  check("signed in as HR (the role that can actually hire)", page.url().includes("/app"), page.url());

  await page.goto(`${BASE}/app/recruitment/applicants/${app.id}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const h1 = await page.locator("h1").first().textContent().catch(() => "");
  check("applicant page loads", h1?.includes(demoApplicant.last_name ?? "?"), `"${(h1 ?? "").trim()}"`);

  // ---- stage movement ----
  // Choosing a stage opens a "Move stage" confirmation. Selecting the option and
  // moving on changes nothing, and the open dialog's overlay then intercepts
  // every later click — which is exactly how the first two runs of this script
  // failed, one as a confusing Playwright "element intercepts pointer events".
  const stageSel = page.locator(`#application-stage-${app.id}`);
  check("stage selector present", await stageSel.count() > 0);
  await stageSel.selectOption("offer");
  await page.waitForTimeout(900);
  const stageDialog = page.locator('[role="dialog"]').last();
  check("stage change asks for confirmation", await stageDialog.count() > 0,
    (await stageDialog.innerText().catch(() => "")).slice(0, 60).replace(/\s+/g, " "));
  await stageDialog.getByRole("button", { name: "Move stage" }).last().click();
  await page.waitForTimeout(4500);

  const moved = await must(db.from("job_applications").select("stage").eq("id", app.id).maybeSingle(), "stage read");
  check("stage moved to offer", moved?.stage === "offer", `stage=${moved?.stage}`);

  const hist = await must(
    db.from("application_stage_history").select("from_stage, to_stage").eq("job_application_id", app.id).order("created_at", { ascending: false }).limit(1),
    "history read",
  );
  check("stage history recorded the move", hist?.[0]?.to_stage === "offer", JSON.stringify(hist?.[0] ?? null));
  // From here on the database has been mutated, so cleanup must run even if the
  // hire below throws. The flag used to be set only after a successful hire,
  // which meant an aborted run left the stage moved.
  hired = true;

  // ---- hire ----
  // Locate by visible text rather than an accessible-name regex: the label
// contains an "&", and a name-regex locator failed to match a button that a
// plain textContent dump shows plainly present.
  const hireBtn = page.locator('button:has-text("create employee")').first();
  check("Hire button visible to HR", await hireBtn.count() > 0,
    (await page.$$eval("button", (els) => els.map((e) => (e.textContent ?? "").trim()).filter(Boolean))).slice(-3).join(" | "));
  await hireBtn.first().click();
  await page.waitForTimeout(900);
  const dlg = page.locator('[role="dialog"]').last();
  check("hire asks for confirmation", await dlg.count() > 0, (await dlg.innerText().catch(() => "")).slice(0, 80).replace(/\s+/g, " "));
  await dlg.getByRole("button", { name: "Hire" }).last().click();
  await page.waitForTimeout(6000);
  hired = true;

  const employeesNow = await must(db.from("employees").select("id, profile_id, employee_number, job_title, employment_status").eq("profile_id", demoApplicant.profile_id), "employees after hire");
  check("an employee record was created", employeesNow.length === 1, JSON.stringify(employeesNow[0] ?? null).slice(0, 140));
  check("employee record is active", employeesNow[0]?.employment_status === "active", employeesNow[0]?.employment_status);

  const afterRoles = (await must(db.from("membership_roles").select("roles!inner(code)").eq("membership_id", membership.id), "roles after"))
    .map((r) => r.roles.code).sort();
  check("hired member has the employee role", afterRoles.includes("employee"), `roles [${afterRoles.join(",")}]`);
  check(
    "no stale applicant role left behind after hiring",
    !afterRoles.includes("applicant"),
    `roles [${afterRoles.join(",")}]`,
  );

  const afterMembership = await must(db.from("organization_memberships").select("membership_type, status").eq("id", membership.id).maybeSingle(), "membership after");
  check("membership became internal", afterMembership.membership_type === "internal", `type=${afterMembership.membership_type}`);
  check("membership is active", afterMembership.status === "active", `status=${afterMembership.status}`);

  const afterApp = await must(db.from("job_applications").select("stage").eq("id", app.id).maybeSingle(), "app after");
  check("application is now hired", afterApp.stage === "hired", `stage=${afterApp.stage}`);

  const auditRows = await must(db.from("audit_logs").select("action").eq("entity_id", app.id), "audit");
  check("hire is audit-logged", auditRows.length > 0, JSON.stringify(auditRows.map((r) => r.action)));

  check("no console errors during the hire", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  await ctx.close();
} finally {
  await restore().catch((e) => console.error("restore failed:", e.message));
  await browser.close().catch(() => {});
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}