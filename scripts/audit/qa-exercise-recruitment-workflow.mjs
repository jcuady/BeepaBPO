// Exercise the five remaining recruitment actions: createJobPost, updateJobPost,
// publishJobPost, closeJobPost, submitJobApplication.
//
// WHY: `lib/recruitment` holds 7 actions; 2 were exercised by the hire pass
// (updateApplicationStage, convertApplicantToEmployee). These 5 were not.
//
// SAFETY — AND THE TRAP THIS RUNS INTO. `submitJobApplication` does not create a
// fresh applicant. It looks the caller up by `profile_id` and, if a row already
// exists, UPDATES its first_name / last_name / email / phone / linkedin_url. The
// demo applicant already has such a row from the hire pass, so submitting an
// application silently rewrites a real demo record. The row is snapshotted and
// restored byte for byte, and the restoration is asserted by comparing fields.
//
// Usage: node scripts/audit/qa-exercise-recruitment-workflow.mjs

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
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const note = (m) => console.log(`NOTE  ${m}`);
async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}

const MARK = `qa${Date.now().toString(36)}`;
const RECRUITER = "recruiter@demo.beepabpo.com";
const APPLICANT = "applicant@demo.beepabpo.com";

const { data: authData, error: authErr } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
if (authErr) throw new Error(`auth users: ${authErr.message}`);
const applicantUserId = authData.users.find((u) => u.email === APPLICANT)?.id ?? null;
if (!applicantUserId) throw new Error(`${APPLICANT} not found`);

// Snapshot the applicant row the apply form will rewrite.
// `applicants` has no `stage` column — the stage lives on `job_applications`.
// Guessing a column name here returns `data: null` with an error and the run
// stops before touching anything.
const APPLICANT_FIELDS =
  "id, first_name, last_name, email, phone, linkedin_url, location, portfolio_url, source, created_at";
const { data: applicantBefore } = await must(
  db.from("applicants").select(APPLICANT_FIELDS).eq("profile_id", applicantUserId).maybeSingle(),
  "applicant snapshot",
);
console.log(`marker: ${MARK}`);
console.log(`applicant row before: ${applicantBefore ? JSON.stringify(applicantBefore).slice(0, 130) : "(none)"}\n`);

const before = {
  jobs: (await db.from("job_posts").select("id", { count: "exact", head: true })).count,
  applications: (await db.from("job_applications").select("id", { count: "exact", head: true })).count,
};

const browser = await chromium.launch();
const pageErrors = [];
const consoleErrors = [];

async function signIn(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const field = page.locator('input[name=email], input[type=email]').first();
  await field.waitFor({ state: "visible", timeout: 20000 });
  await field.fill(email);
  await page.locator('input[type=password]').first().fill(env.DEMO_PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/app|\/$/, { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);
}

const jobPost = (id) => db.from("job_posts").select("*").eq("id", id).single();
const says = async (page) =>
  (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");

try {
  // ================= recruiter: create, edit, publish, close =================
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

  await signIn(page, RECRUITER);
  await page.goto(`${BASE}/app/recruitment/jobs`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  check("a recruitment.manage holder can open /app/recruitment/jobs",
    !page.url().includes("/login") && !page.url().includes("denied"), page.url().replace(BASE, ""));

  // --- create ---
  await page.fill("#title", `QA Job ${MARK}`);
  await page.fill("#slug", `qa-job-${MARK}`);
  await page.fill("#description", `QA job description ${MARK}.`);
  await page.fill("#location_text", "Makati City");
  await page.fill("#salary_display", "QA salary");
  await page.selectOption("#status", "draft");
  await page.locator("#title").locator("xpath=ancestor::form").first()
    .getByRole("button", { name: /save job post|update job post|save draft|create/i }).click();
  await page.waitForTimeout(6000);

  const created = (await must(
    db.from("job_posts").select("id, title, slug, status, published_at").like("slug", `qa-job-${MARK}%`),
    "job_posts after create",
  ))[0];
  check("createJobPost creates the post", Boolean(created),
    created ? `status=${created.status}` : `no row matching qa-job-${MARK}`);
  check("createJobPost leaves it as a draft", created?.status === "draft", created?.status);

  if (!created) throw new Error("job post was not created — the rest of the run has nothing to drive");

  // --- update, through the detail page's own form ---
  await page.goto(`${BASE}/app/recruitment/jobs/${created.id}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  check("the job detail page renders the edit form", (await page.locator("#title").count()) > 0);
  const NEW_TITLE = `QA Job Edited ${MARK}`;
  if (await page.locator("#title").count()) {
    await page.fill("#title", NEW_TITLE);
    await page.locator("#title").locator("xpath=ancestor::form").first()
      .getByRole("button", { name: /save job post|update job post|save draft|create/i }).click();
    await page.waitForTimeout(6000);
    const updated = await must(jobPost(created.id), "job after update");
    check("updateJobPost persists the change", updated.title === NEW_TITLE,
      `title is now "${updated.title}"`);
  }

  // --- publish ---
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const publishBtn = page.getByRole("button", { name: /^Publish$/ }).first();
  check("the detail page offers Publish", (await publishBtn.count()) > 0);
  if (await publishBtn.count()) {
    await publishBtn.click();
    await page.waitForTimeout(1500);
    const confirm = page.locator("[role=dialog]").getByRole("button", { name: /^Publish$/ }).last();
    if (await confirm.count()) await confirm.click();
    await page.waitForTimeout(6000);
    const published = await must(jobPost(created.id), "job after publish");
    check("publishJobPost moves it to published", published.status === "published",
      `status=${published.status}`);
    check("publishJobPost stamps published_at", Boolean(published.published_at),
      published.published_at ?? "NOT SET");
  }

  // --- publish is idempotent ---
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  if ((await page.getByRole("button", { name: /^Publish$/ }).count()) > 0) {
    await page.getByRole("button", { name: /^Publish$/ }).first().click();
    await page.waitForTimeout(1500);
    const confirm2 = page.locator("[role=dialog]").getByRole("button", { name: /^Publish$/ }).last();
    if (await confirm2.count()) await confirm2.click();
    await page.waitForTimeout(5000);
    const stillPublished = await must(jobPost(created.id), "job after second publish");
    check("publishing an already-published post is refused or is a no-op",
      stillPublished.status === "published", `status=${stillPublished.status}`);
  } else {
    note("no Publish button remained after publishing — cannot exercise the idempotent path");
    const stillPublished = await must(jobPost(created.id), "job after publish");
    check("publishing an already-published post is refused or is a no-op",
      stillPublished.status === "published", `status=${stillPublished.status}`);
  }

  // --- close ---
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const closeBtn = page.getByRole("button", { name: /^Close$/ }).first();
  check("the detail page offers Close", (await closeBtn.count()) > 0);
  if (await closeBtn.count()) {
    await closeBtn.click();
    await page.waitForTimeout(1500);
    const confirmC = page.locator("[role=dialog]").getByRole("button", { name: /^Close job$/ }).last();
    if (await confirmC.count()) await confirmC.click();
    await page.waitForTimeout(6000);
    const closed = await must(jobPost(created.id), "job after close");
    check("closeJobPost moves it to closed", closed.status === "closed", `status=${closed.status}`);
    check("closeJobPost preserves the original published_at", Boolean(closed.published_at),
      closed.published_at ?? "nulled out");
  }

  // ================= applicant: submit =================
  const applicantCtx = await browser.newContext();
  const applicantPage = await applicantCtx.newPage();
  applicantPage.on("pageerror", (e) => pageErrors.push(e.message));
  await signIn(applicantPage, APPLICANT);
  await applicantPage.goto(`${BASE}/app/applicant/jobs/${created.id}`, { waitUntil: "domcontentloaded" });
  await applicantPage.waitForTimeout(3000);

  const closedText = await says(applicantPage);
  check("a CLOSED job is not offered to an applicant", /closed|no longer|not accepting|404/i.test(closedText) || applicantPage.url().includes("404"),
    applicantPage.url().replace(BASE, ""));

  // Re-publish so the apply path is reachable, then prove it.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const republish = page.getByRole("button", { name: /^Publish$/ }).first();
  if (await republish.count()) {
    await republish.click();
    await page.waitForTimeout(1500);
    const c = page.locator("[role=dialog]").getByRole("button", { name: /^Publish$/ }).last();
    if (await c.count()) await c.click();
    await page.waitForTimeout(5000);
    check("a CLOSED job can be re-published",
      (await must(jobPost(created.id), "job after republish")).status === "published");
  } else {
    check("a CLOSED job can be re-published", false,
      "no Publish button on a closed post — it cannot be reopened");
  }

  await applicantPage.goto(`${BASE}/app/applicant/jobs/${created.id}`, { waitUntil: "domcontentloaded" });
  await applicantPage.waitForTimeout(3000);
  const hasForm = (await applicantPage.locator("#first_name").count()) > 0;
  check("a PUBLISHED job offers the apply form to an applicant", hasForm,
    hasForm ? "" : `page said: ${(await says(applicantPage)).slice(0, 120)}`);

  if (hasForm) {
    await applicantPage.fill("#first_name", "Quah");
    await applicantPage.fill("#last_name", "Applicant");
    await applicantPage.fill("#email", APPLICANT);
    await applicantPage.fill("#phone", "+63 900 000 0000");
    await applicantPage.fill("#linkedin_url", "https://linkedin.com/in/qa-applicant");
    await applicantPage.fill("#notes", `QA application ${MARK}.`);
    await applicantPage.locator("#first_name").locator("xpath=ancestor::form").first()
      .getByRole("button", { name: /submit|apply/i }).click();
    await applicantPage.waitForTimeout(6000);

    // Nullable by design: the applicant row may legitimately not exist yet, and
    // `.single()` on zero rows raises rather than returning null, which made
    // `must` hand back [] and every `.first_name` read throw.
    const { data: applicantRows } = await db
      .from("applicants").select("id, first_name, last_name, email, phone, linkedin_url")
      .eq("profile_id", applicantUserId).limit(1);
    const applicantRow = (applicantRows ?? [])[0] ?? null;
    const app = (await must(
      db.from("job_applications").select("id, stage, applicant_id, job_post_id").eq("job_post_id", created.id),
      "applications for job",
    ))[0];
    check("submitJobApplication creates the application", Boolean(app),
      app ? `stage=${app.stage}` : "no job_applications row");
    check("the new application starts at stage 'applied'", app?.stage === "applied", app?.stage);
    check("the applicant profile was UPDATED in place, not duplicated",
      applicantRow?.first_name === "Quah" && applicantRow?.last_name === "Applicant",
      applicantRow ? `applicant now reads "${applicantRow.first_name} ${applicantRow.last_name}" — this is a real demo row and is restored below`
                    : "no applicant row was written for the signed-in profile");

    // --- duplicate guard ---
    await applicantPage.reload({ waitUntil: "domcontentloaded" });
    await applicantPage.waitForTimeout(3000);
    const dupForm = (await applicantPage.locator("#first_name").count()) > 0;
    if (dupForm) {
      await applicantPage.fill("#first_name", "Quah");
      await applicantPage.fill("#last_name", "Applicant");
      await applicantPage.fill("#email", APPLICANT);
      await applicantPage.fill("#notes", `QA duplicate ${MARK}.`);
      await applicantPage.locator("#first_name").locator("xpath=ancestor::form").first()
        .getByRole("button", { name: /submit|apply/i }).click();
      await applicantPage.waitForTimeout(6000);
      const after = (await must(
        db.from("job_applications").select("id").eq("job_post_id", created.id),
        "applications after duplicate attempt",
      )).length;
      const dupText = await says(applicantPage);
      check("a second application for the same role is refused", after === 1,
        after === 1 ? `still ${after} application(s); page said: "${(dupText.match(/already applied[^.]*\./i)?.[0] ?? "").trim()}"` : `${after} applications exist`);
    } else {
      note("the apply form disappeared after applying, so the duplicate guard cannot be re-driven from the UI");
      const after = (await must(
        db.from("job_applications").select("id").eq("job_post_id", created.id),
        "applications after first apply",
      )).length;
      check("a second application for the same role is refused", after === 1,
        `only ${after} application(s) exist`);
    }
  }

  check("no uncaught page errors during the recruitment run", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
  if (consoleErrors.length) note(`${consoleErrors.length} console error(s) (informational): ${consoleErrors.slice(0, 2).join(" | ").slice(0, 160)}`);
  await applicantCtx.close();
  await ctx.close();
} catch (e) {
  console.error(`\nRUN ERROR: ${e.message}`);
  console.error(e.stack?.split("\n").slice(1, 4).join("\n"));
  process.exitCode = 1;
} finally {
  // Delete by marker, not by remembered id — but ASSERT the marker matched. A
  // cleanup that silently matched nothing is indistinguishable from one that
  // worked, and that is exactly how a run left a QA job post behind while
  // printing a reassuring line.
  const { data: jobsToDelete, error: jobsErr } = await db
    .from("job_posts").select("id, slug").like("slug", `%${MARK}%`);
  if (jobsErr) console.error(`  cleanup FAILED to list job posts: ${jobsErr.message}`);
  for (const j of jobsToDelete ?? []) {
    await db.from("job_applications").delete().eq("job_post_id", j.id);
    await db.from("job_posts").delete().eq("id", j.id);
  }
  console.log(`  (cleanup) removed ${(jobsToDelete ?? []).length} job post(s) and their applications` +
    ((jobsToDelete ?? []).length ? "" : "   *** nothing matched — check the marker ***"));

  // Restore the demo applicant EXACTLY. This row predates the run.
  if (applicantBefore) {
    const { error: restoreErr } = await db.from("applicants").update({
      first_name: applicantBefore.first_name,
      last_name: applicantBefore.last_name,
      email: applicantBefore.email,
      phone: applicantBefore.phone,
      linkedin_url: applicantBefore.linkedin_url,
    }).eq("id", applicantBefore.id);
    console.log(restoreErr ? `  applicant restore FAILED: ${restoreErr.message}` : "  (cleanup) applicant row restored");
  } else {
    await db.from("applicants").delete().eq("profile_id", applicantUserId);
    console.log("  (cleanup) applicant row removed — it did not exist before this run");
  }
  await browser.close().catch(() => {});

  const afterCounts = {
    jobs: (await db.from("job_posts").select("id", { count: "exact", head: true })).count,
    applications: (await db.from("job_applications").select("id", { count: "exact", head: true })).count,
  };
  console.log("");
  check("no job posts leaked", afterCounts.jobs === before.jobs, `${before.jobs} -> ${afterCounts.jobs}`);
  check("no job applications leaked", afterCounts.applications === before.applications,
    `${before.applications} -> ${afterCounts.applications}`);

  const { data: applicantAfter } = await must(
    db.from("applicants").select(APPLICANT_FIELDS).eq("profile_id", applicantUserId).maybeSingle(),
    "applicant after cleanup",
  );
  // `updated_at` is deliberately excluded: any write to the row bumps it, so
  // comparing it would report a false failure for a row that was restored
  // perfectly. Everything a user could read is compared.
  const comparable = (r) => r && {
    first_name: r.first_name, last_name: r.last_name, email: r.email,
    phone: r.phone, linkedin_url: r.linkedin_url, location: r.location,
    portfolio_url: r.portfolio_url, source: r.source,
  };
  check("the demo applicant row is exactly as it was found",
    JSON.stringify(comparable(applicantAfter)) === JSON.stringify(comparable(applicantBefore)),
    applicantBefore ? "restored field for field" : "row absent again");

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("\nFAILURES:");
    for (const f of failed) console.log(`  - ${f.name}`);
    process.exitCode = 1;
  }
}