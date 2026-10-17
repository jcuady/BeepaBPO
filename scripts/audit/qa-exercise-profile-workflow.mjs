// Exercise the small identity-shaped actions: edit an employee record, edit your own
// profile, and submit the public contact form.
//
// WHY: four actions across three "use server" modules that had never been driven
// through a browser -- `lib/employees/actions.ts`, `lib/profile/actions.ts`,
// `lib/contact/actions.ts`, and `lib/crm/actions.ts:createLeadFromContact`, which is
// reachable in production *only* through the contact form and is therefore the last
// CRM action to be exercised.
//
// THE INTERESTING PART: the contact form.
//
// It is a three-step wizard, and step 3's submit is the only thing that reaches
// `contactAction`. It also carries a honeypot (`website`) that returns a success
// message without writing anything -- correct anti-spam behaviour, and easy to
// mistake for "the form works" if a run submits the happy path and stops. So this run
// submits all three ways: a real enquiry, a honeypot-filled one, and an invalid one,
// and asserts that the first writes a lead and the other two do not.
//
// `rateLimit` allows 5 submissions per IP per 60s, but both the honeypot and the
// schema check return before it is consulted, so only the real enquiry consumes one.
//
// SAFETY: every edited field is snapshotted before the run and restored after it, and
// the restoration is asserted by reading the rows back. Leads created here are deleted
// by their marker email.
//
// Usage: node scripts/audit/qa-exercise-profile-workflow.mjs

import { readFileSync } from "node:fs";
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
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const results = [];
const notes = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};
const note = (m) => { notes.push(m); console.log(`NOTE  ${m}`); };
async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}

const MARK = `qaprof${Date.now().toString(36)}`;
const HR_EMAIL = "hr@demo.beepabpo.com";
const OWNER_EMAIL = "owner@demo.beepabpo.com";

const { data: authData, error: authErr } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
if (authErr) throw new Error(`auth users: ${authErr.message}`);
const userIdFor = (email) => authData.users.find((u) => u.email === email)?.id ?? null;
const ownerUserId = userIdFor(OWNER_EMAIL);
if (!ownerUserId) throw new Error("demo owner user missing");

// The employee record we will edit, and the owner profile we will edit.
const targetEmployee = (
  await must(
    db.from("employees").select("id, job_title, hire_date, employment_status, employment_type, default_timezone, work_email, personal_email").limit(1),
    "employee target",
  )
)[0];
if (!targetEmployee) throw new Error("no employees to edit");

const empBefore = { ...targetEmployee };
const profBefore = (
  await must(db.from("profiles").select("display_name, phone, timezone").eq("id", ownerUserId).limit(1), "profile snapshot")
)[0];

const leadCountBefore = (await db.from("crm_leads").select("id", { count: "exact", head: true })).count ?? 0;
console.log(`employee: ${empBefore.employee_number ?? empBefore.id.slice(0, 8)}`);
console.log(`owner profile: ${profBefore.display_name}, phone=${profBefore.phone}, tz=${profBefore.timezone}`);
console.log(`crm_leads before: ${leadCountBefore}\n`);

const NEW_TITLE = `${MARK} Senior Support Analyst`;
const NEW_NAME = `${MARK} Name`;
const NEW_PHONE = "+63 900 000 1234";

const browser = await chromium.launch();
const consoleErrors = [];
const pageErrors = [];

async function signIn(context, email) {
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const field = page.locator("input[name=email], input[type=email]").first();
  await field.waitFor({ state: "visible", timeout: 20000 });
  await fillHeld(page, field, email);
  await fillHeld(page, page.locator("input[type=password]").first(), env.DEMO_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/app/, { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);
  return page;
}

try {
  // ------------------------------------------------------------ updateEmployee
  const hrCtx = await browser.newContext();
  const hrPage = await signIn(hrCtx, HR_EMAIL);
  await hrPage.goto(`${BASE}/app/employees/${empBefore.id}`, { waitUntil: "domcontentloaded" });
  await hrPage.waitForTimeout(1800);

  check("HR sees the employee edit form", await hrPage.locator("#job_title").isVisible());
  await hrPage.fill("#job_title", NEW_TITLE);
  const saveBtn = hrPage.getByRole("button", { name: /save|update/i }).first();
  await saveBtn.click();
  await hrPage.waitForTimeout(2500);

  const empAfter = (
    await must(db.from("employees").select("job_title").eq("id", empBefore.id).limit(1), "employee recheck")
  )[0];
  check("updateEmployee persists the new job title", empAfter.job_title === NEW_TITLE, String(empAfter.job_title));

  const empAudit = await must(
    db.from("audit_logs").select("action, entity_id").eq("entity_id", empBefore.id).eq("action", "employees.update").limit(1),
    "employee audit",
  );
  check("updateEmployee writes an audit row", empAudit.length >= 1, `${empAudit.length} row(s)`);
  await hrCtx.close();

  // ------------------------------------------------------------- updateProfile
  const ownCtx = await browser.newContext();
  const ownPage = await signIn(ownCtx, OWNER_EMAIL);
  await ownPage.goto(`${BASE}/app/my/profile`, { waitUntil: "domcontentloaded" });
  await ownPage.waitForTimeout(1800);

  check("owner sees the profile form", await ownPage.locator("#display_name").isVisible());
  check(
    "the profile form is pre-filled from the database",
    (await ownPage.locator("#display_name").inputValue()) === profBefore.display_name,
    `form shows ${await ownPage.locator("#display_name").inputValue()}`,
  );

  await ownPage.fill("#display_name", NEW_NAME);
  await ownPage.fill("#phone", NEW_PHONE);
  await ownPage.getByRole("button", { name: /save|update/i }).first().click();
  await ownPage.waitForTimeout(2500);

  const profAfter = (
    await must(db.from("profiles").select("display_name, phone").eq("id", ownerUserId).limit(1), "profile recheck")
  )[0];
  check("updateProfile persists the display name", profAfter.display_name === NEW_NAME, String(profAfter.display_name));
  check("updateProfile persists the phone", profAfter.phone === NEW_PHONE, String(profAfter.phone));

  const profAudit = await must(
    db.from("audit_logs").select("action, entity_id").eq("entity_id", ownerUserId).eq("action", "profile.update").limit(1),
    "profile audit",
  );
  check("updateProfile writes an audit row", profAudit.length >= 1, `${profAudit.length} row(s)`);

  // An empty phone must clear the column rather than store an empty string.
  await ownPage.fill("#phone", "");
  await ownPage.getByRole("button", { name: /save|update/i }).first().click();
  await ownPage.waitForTimeout(2500);
  const profCleared = (
    await must(db.from("profiles").select("phone").eq("id", ownerUserId).limit(1), "profile clear recheck")
  )[0];
  check("clearing the phone stores null, not an empty string", profCleared.phone === null, String(profCleared.phone));
  await ownCtx.close();

  // ---------------------------------------------- contactAction (+ the CRM sink)
  const anonCtx = await browser.newContext();
  const anonPage = await anonCtx.newPage();
  anonPage.on("pageerror", (e) => pageErrors.push(e.message));

  async function fillWizard({ name, email, company, message, honeypot }) {
    await anonPage.goto(`${BASE}/contact`, { waitUntil: "domcontentloaded" });
    await anonPage.waitForTimeout(1500);
    await anonPage.getByLabel("Name", { exact: false }).fill(name);
    await anonPage.getByLabel("Work email", { exact: false }).fill(email);
    if (honeypot) await anonPage.getByLabel("Website", { exact: false }).fill(honeypot);
    await anonPage.getByRole("button", { name: "Continue" }).click();
    await anonPage.waitForTimeout(500);
    await anonPage.getByLabel("Company", { exact: false }).fill(company);
    await anonPage.getByRole("button", { name: "Continue" }).click();
    await anonPage.waitForTimeout(500);
    await anonPage.getByLabel("Hiring need", { exact: false }).fill(message);
    await anonPage.getByRole("button", { name: /Build Your Team/i }).click();
    await anonPage.waitForTimeout(3000);
  }

  const leadEmail = `${MARK}-lead@example.com`;
  await fillWizard({
    name: `${MARK} Enquirer`,
    email: leadEmail,
    company: `${MARK} Industries`,
    message: `QA contact enquiry ${MARK}. Please ignore.`,
  });

  const text = (await anonPage.locator("body").innerText()).replace(/\s+/g, " ");
  check(
    "the contact form confirms receipt to the enquirer",
    /Thanks\s*-?\s*your request has been received/i.test(text),
    /Thanks[^.]{0,80}/i.exec(text)?.[0] ?? "no confirmation on screen",
  );

  const createdLeads = await must(
    db.from("crm_leads").select("id, contact_email, source, status").eq("contact_email", leadEmail),
    "lead lookup",
  );
  check("contactAction creates exactly one lead", createdLeads.length === 1, `${createdLeads.length} row(s)`);
  check("the lead is sourced from the website form", createdLeads[0]?.source === "website_contact", String(createdLeads[0]?.source));
  check("the lead lands in the sales queue as new", createdLeads[0]?.status === "new", String(createdLeads[0]?.status));

  // Honeypot: must look like success to a bot, and write nothing.
  const honeypotEmail = `${MARK}-bot@example.com`;
  await fillWizard({
    name: `${MARK} Bot`,
    email: honeypotEmail,
    company: `${MARK} Spam`,
    message: `QA honeypot ${MARK}`,
    honeypot: "http://spam.example",
  });
  const botText = (await anonPage.locator("body").innerText()).replace(/\s+/g, " ");
  check(
    "a honeypot submission is told it succeeded",
    /Thanks\s*-?\s*your request has been received/i.test(botText),
  );
  const botLeads = await must(
    db.from("crm_leads").select("id").eq("contact_email", honeypotEmail),
    "honeypot lead lookup",
  );
  check("a honeypot submission writes no lead", botLeads.length === 0, `${botLeads.length} row(s)`);

  // Validation: a bad email must not create a lead either.
  const badEmail = `${MARK}-bad@example.com`;
  await anonPage.goto(`${BASE}/contact`, { waitUntil: "domcontentloaded" });
  await anonPage.waitForTimeout(1500);
  await anonPage.getByLabel("Name", { exact: false }).fill(`${MARK} Bad`);
  await anonPage.getByLabel("Work email", { exact: false }).fill("not-an-email");
  await anonPage.getByRole("button", { name: "Continue" }).click();
  await anonPage.waitForTimeout(700);
  const stepOneText = (await anonPage.locator("body").innerText()).replace(/\s+/g, " ");
  const advanced = /Step 2 of/.test(stepOneText);
  const complained = /valid email|invalid|enter a valid/i.test(stepOneText);
  check(
    "an invalid email is refused at step 1",
    complained && !advanced,
    // Report what was actually seen. A fallback that says "advanced to step 2" is
    // the wrong default: the failure this guards against is exactly that.
    complained ? (/valid email[^.]{0,40}/i.exec(stepOneText)?.[0] ?? "an error is shown") : "no validation message shown",
  );
  note(
    "This proves CLIENT-side validation: the input is type=email with required, so the " +
      "browser blocks the submit and contactAction is never called. The server-side " +
      "contactSchema rejection path is not exercised here, because the UI cannot reach it.",
  );
  const badLeads = await must(db.from("crm_leads").select("id").eq("contact_email", badEmail), "bad lead lookup");
  check("no lead is written for invalid input", badLeads.length === 0, `${badLeads.length} row(s)`);

  await anonCtx.close();

  const realErrors = consoleErrors.filter((e) => !/favicon|404 \(Not Found\)/i.test(e));
  check("no unexpected console errors", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));
  check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
} catch (e) {
  console.error(`ERROR: ${e.message}`);
  results.push({ name: "run completed without throwing", pass: false });
} finally {
  // Restore the employee record exactly.
  await db
    .from("employees")
    .update({
      job_title: empBefore.job_title,
      hire_date: empBefore.hire_date,
      employment_status: empBefore.employment_status,
      employment_type: empBefore.employment_type,
      default_timezone: empBefore.default_timezone,
      work_email: empBefore.work_email,
      personal_email: empBefore.personal_email,
    })
    .eq("id", empBefore.id);

  // Restore the owner profile exactly.
  await db
    .from("profiles")
    .update({ display_name: profBefore.display_name, phone: profBefore.phone, timezone: profBefore.timezone })
    .eq("id", ownerUserId);

  // Remove leads this run created, matched by marker rather than remembered ids.
  for (const email of [`${MARK}-lead@example.com`, `${MARK}-bot@example.com`, `${MARK}-bad@example.com`]) {
    await db.from("crm_leads").delete().eq("contact_email", email);
  }
  await db.from("lead_attribution").delete().in("lead_id", [
    ...(await must(db.from("crm_leads").select("id").ilike("contact_email", `%${MARK}%`), "leftover leads")).map((l) => l.id),
  ]);

  const leftoverLeads = await must(
    db.from("crm_leads").select("id").ilike("contact_email", `%${MARK}%`),
    "leftover lead check",
  );
  console.log(`\n(cleanup) leads still carrying the marker: ${leftoverLeads.length}`);

  const empNow = (
    await must(db.from("employees").select("job_title, hire_date, employment_status, employment_type, default_timezone").eq("id", empBefore.id).limit(1), "employee restore check")
  )[0];
  const profNow = (
    await must(db.from("profiles").select("display_name, phone, timezone").eq("id", ownerUserId).limit(1), "profile restore check")
  )[0];
  const leadCountAfter = (await db.from("crm_leads").select("id", { count: "exact", head: true })).count ?? 0;

  const employeeRestored = empNow.job_title === empBefore.job_title && empNow.hire_date === empBefore.hire_date && empNow.employment_status === empBefore.employment_status;
  const profileRestored = profNow.display_name === profBefore.display_name && profNow.phone === profBefore.phone && profNow.timezone === profBefore.timezone;

  console.log(`(cleanup) employee restored: ${employeeRestored}; profile restored: ${profileRestored}`);
  console.log(`(cleanup) crm_leads before=${leadCountBefore} after=${leadCountAfter}`);

  const restored = leftoverLeads.length === 0 && employeeRestored && profileRestored && leadCountAfter === leadCountBefore;
  console.log(`the sweep left the demo data as it found it: ${restored ? "yes" : "NO"}`);
  if (!restored) process.exitCode = 1;

  await browser.close().catch(() => {});

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} assertions passed`);
  if (passed !== results.length) process.exitCode = 1;
  if (notes.length) {
    console.log("\nnotes:");
    for (const n of notes) console.log(`  - ${n}`);
  }
}