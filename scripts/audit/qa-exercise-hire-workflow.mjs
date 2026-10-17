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
import { fillHeld, submitAndWaitOutcome } from "./lib/browser-form.mjs";

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

// For `maybeSingle()` reads, where "no row" is a legitimate answer rather than an error.
//
// `must()` is deliberately wrong for these: it returns `data ?? []`, so a single-row read
// that found nothing yields `[]` -- which is TRUTHY. `finalApp === null` was therefore false
// for a genuinely deleted row, the cleanup check reported `application=stage=undefined`,
// and a run that had restored the database perfectly was scored as a failure. An empty
// array and a missing row are the same fact and must compare equal here.
async function mustOne(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? null;
}

// Records fixture rows the moment they are created, at module scope, so that a failure
// ANYWHERE -- including during target resolution, before `restore()` exists -- still knows
// what to roll back. It used to be a `const` built after resolution finished, which meant
// the one window that actually leaked had nothing to report.
const FIXTURE_CREATED = { applicant: null, application: null };

// Seed at `client_interview`, NOT at `offer`.
//
// The first version of this script seeded the fixture at `offer` -- "one step from the
// action under test" -- and then tried to drive the stage dropdown to `offer`. That is a
// no-op, and `ApplicationStageForm` correctly ignores one:
//   function handleChange(stage) { if (stage === currentStage) return; ... }
// so no confirmation dialog ever opened and the run died on a 30s click timeout. The app
// was right; the fixture contradicted itself. Starting one step earlier makes the move a
// genuine transition, and puts `offer -> hired` immediately before the hire button.
const FIXTURE_START_STAGE = "client_interview";
const FIXTURE_OFFER_STAGE = "offer";

async function main() {

// ---- resolve the target: Demo Applicant's application ----
//
// This used to hard-fail with `process.exit(1)` when the seeded Demo Applicant had no
// `applicants` row, and that had two consequences. It never ran: the demo org has no
// applicant row for `applicant@demo.beepabpo.com`, so the hire path had been unexercisable
// for the whole QA effort. And `process.exit()` while Playwright's handles are still open
// aborted the process inside libuv --
//   Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76
// -- which destroyed the real error message and replaced it with a native crash. That is
// why a missing seed row looked like a Node bug in every earlier sweep.
//
// The person exists and is complete: the auth user has an `applicant/active` membership and
// a profile. Only the `applicants` + `job_applications` rows are absent, so the exercise
// now seeds them itself and removes them in `restore()`. Verified with
// `qa-probe-orphan-memberships.mjs` (13 memberships, 13 profiles, 0 orphans) and
// `qa-probe-hire-target.mjs`.
let demoApplicant = (
  await must(db.from("applicants").select("id, profile_id, first_name, last_name, email"), "applicants")
).find((a) => a.email === "applicant@demo.beepabpo.com");

if (!demoApplicant?.profile_id) {
  // Resolve the person through the auth user, which is the source of truth for who the
  // demo account is. `admin.auth.admin.listUsers` is the only way; `auth.users` is not
  // exposed through the Data API.
  const { data: users, error: usersErr } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (usersErr) { console.error(`listUsers failed: ${usersErr.message}`); process.exitCode = 1; throw new Error("no auth users"); }
  const demoUser = users.users.find((u) => u.email === "applicant@demo.beepabpo.com");
  if (!demoUser) {
    console.error("No auth user for applicant@demo.beepabpo.com; this is not a fixture gap.");
    process.exitCode = 1;
    throw new Error("demo applicant auth user missing");
  }
  const { data: profile } = await db
    .from("profiles").select("id, display_name").eq("id", demoUser.id).maybeSingle();
  if (!profile) {
    console.error(`Auth user ${demoUser.id} has no profile; the hire action needs one.`);
    process.exitCode = 1;
    throw new Error("demo applicant has no profile");
  }

  // Deliberately NOT "Demo"/"Applicant".
  //
  // `convertApplicantToEmployee` rewrites the profile to `${first_name} ${last_name}`. A
  // fixture named "Demo Applicant" therefore overwrites "Demo Applicant" with "Demo
  // Applicant", and the restore check -- which compares the profile against its snapshot
  // -- passes whether or not a restore ever happened. It could not fail, so it proved
  // nothing. A distinct name makes the overwrite visible, which is what gives the check its
  // value: leave the profile dirty and the run now reports a mismatch.
  console.log(`NOTE  seeding a fixture applicant for ${demoUser.email} (no applicants row exists)`);
  demoApplicant = (await must(
    db.from("applicants").insert({
      email: demoUser.email,
      first_name: "Qa",
      last_name: "Hireprobe",
      source: "qa_hire_fixture",
      profile_id: profile.id,
    }).select("id, profile_id, first_name, last_name, email").limit(1),
    "seed applicant",
  ))[0];
  FIXTURE_CREATED.applicant = demoApplicant.id;
}
let apps = await must(
  db.from("job_applications").select("id, stage, applicant_id").eq("applicant_id", demoApplicant.id),
  "applications",
);
let app = apps[0];
if (!app) {
  // The table is `job_posts`, not `job_postings`, and the FK is `job_post_id`, not
  // `job_posting_id`. An earlier version of this script got both wrong and reported
  //   Error: no published job
  // which was a false diagnosis twice over. PostgREST had actually answered
  //   Could not find the table 'public.job_postings' in the schema cache
  // and this script swallowed it by destructuring `{ data: job }` without checking
  // `error` -- the same mistake this file's own header warns about. There were 5
  // published posts in the seed data the whole time. `must()` now makes an unknown
  // table an error instead of an empty result.
  const job = (await must(
    db.from("job_posts")
      .select("id, title")
      .eq("status", "published")
      .order("created_at", { ascending: true })
      .limit(1),
    "published job post",
  ))[0];
  if (!job) {
    console.error("No published job posting to attach the fixture application to.");
    process.exitCode = 1;
    throw new Error("no published job");
  }
  app = (await must(
    db.from("job_applications").insert({
      applicant_id: demoApplicant.id,
      job_post_id: job.id,
      stage: FIXTURE_START_STAGE,
    }).select("id, stage, applicant_id").limit(1),
    "seed job application",
  ))[0];
  FIXTURE_CREATED.application = app.id;
  console.log(`NOTE  seeded a fixture job_application at stage=${app.stage} on "${job.title}"`);
}
apps = [app];

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

// `convertApplicantToEmployee` overwrites the PROFILE row, not just recruitment data:
//   admin.from("profiles").update({ first_name, last_name, display_name, status })
// `display_name` is rebuilt as `${first_name} ${last_name}` and `status` is forced to
// "active" (or "invited" for a fresh invite). This script had no snapshot of it, so a run
// that hired the demo applicant would have silently renamed that account to
// "Demo Applicant" for good. Snapshot it and put it back.
const profileBefore = await must(
  db.from("profiles")
    .select("id, first_name, last_name, display_name, status")
    .eq("id", demoApplicant.profile_id)
    .maybeSingle(),
  "profile before",
);
if (!profileBefore) {
  console.error("target profile is missing; the hire action would write to a profile that does not exist");
  process.exitCode = 1;
  throw new Error("target profile missing");
}

console.log(`target: ${demoApplicant.first_name} ${demoApplicant.last_name}  application=${app.id}`);
console.log(`original: stage=${app.stage}  membership_type=${membership.membership_type} status=${membership.status} roles=[${originalCodes.join(",")}]`);

const browser = await chromium.launch();
let hired = false;

async function restore() {
  if (!APPLY_CLEANUP) { console.log("\ncleanup: skipped (--no-cleanup)"); return; }

  // Remove the fixture rows this run created, so the seeded demo data is left exactly as
  // found. Ordered child-first: an application references an applicant.
  if (FIXTURE_CREATED.application) {
    const { error: e1 } = await db.from("job_applications").delete().eq("id", FIXTURE_CREATED.application);
    console.log(`cleanup: seeded application ${e1 ? `FAILED ${e1.message}` : "deleted"}`);
  }
  if (FIXTURE_CREATED.applicant) {
    const { error: e2 } = await db.from("applicants").delete().eq("id", FIXTURE_CREATED.applicant);
    console.log(`cleanup: seeded applicant ${e2 ? `FAILED ${e2.message}` : "deleted"}`);
  }

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

    // The action writes the profile it hires the person into. Put the original back --
    // this is the one mutation outside recruitment that would otherwise survive the run.
    //
    // `--skip-profile-restore` exists to prove the check below can actually fail. A check
    // that has never been seen red is not evidence; this is the switch that turns it red.
    if (process.argv.includes("--skip-profile-restore")) {
      console.log("cleanup: SKIPPING profile restore (--skip-profile-restore) — the state check is expected to FAIL");
    } else {
      const { error: profileErr } = await db
        .from("profiles")
        .update({
          first_name: profileBefore.first_name,
          last_name: profileBefore.last_name,
          display_name: profileBefore.display_name,
          status: profileBefore.status,
        })
        .eq("id", profileBefore.id);
      console.log(`cleanup: profile restored${profileErr ? ` FAILED ${profileErr.message}` : ""}`);
    }

    // `application.*` audit rows. Audit logs are append-only by design, so
    // they are NOT deleted in general -- but when this run created the application, those
    // rows point at an application id that is about to be deleted, leaving a dangling
    // reference. Only in that case are they removed, and then only rows matching this run's
    // own entity_id, which is unique because the fixture id is a fresh uuid. A pre-existing
    // demo application's audit history is never touched.
    //
    // BOTH actions this run writes, not just the hire. Cleaning only `hire_convert` left a
    // `stage_update` row behind on every single run -- the residue probe caught the dangling
    // count climbing 10 -> 12 across two runs that both reported a clean cleanup.
    if (FIXTURE_CREATED.application) {
      // Guarded on its own. A stale identifier in this block once aborted the REST of
      // cleanup -- including the verification below -- while the run still reported
      // "17/17 checks passed" and exit 0, because the throw was swallowed by the
      // `.catch` in the `finally`. A check that never ran must not read as a pass.
      try {
        const { data: auditRows, error: auditErr } = await db
          .from("audit_logs")
          .delete()
          .eq("entity_id", FIXTURE_CREATED.application)
          .in("action", ["application.stage_update", "application.hire_convert"])
          .select("id");
        console.log(`cleanup: ${auditErr ? `audit FAILED ${auditErr.message}` : `${auditRows?.length ?? 0} fixture audit row(s) deleted`}`);
      } catch (e) {
        console.log(`cleanup: audit cleanup threw ${e.message}`);
      }
    } else {
      console.log("cleanup: audit rows kept (application was pre-existing, not a fixture)");
    }
  }

  // verify by re-reading
  const finalRoles = (await must(db.from("membership_roles").select("roles!inner(code)").eq("membership_id", membership.id), "final roles"))
    .map((r) => r.roles.code).sort();
  const finalMembership = await mustOne(db.from("organization_memberships").select("membership_type, status").eq("id", membership.id).maybeSingle(), "final membership");
  const finalApp = await mustOne(db.from("job_applications").select("stage").eq("id", app.id).maybeSingle(), "final app");
  const finalEmployees = await must(db.from("employees").select("id"), "final employees");
  const finalProfile = await mustOne(
    db.from("profiles")
      .select("first_name, last_name, display_name, status")
      .eq("id", profileBefore.id)
      .maybeSingle(),
    "final profile",
  );
  // A seeded application is supposed to be GONE by now, so `finalApp` is legitimately null
  // and `finalApp.stage` used to throw a TypeError here -- which the `.catch` in the
  // `finally` swallowed as "restore failed", so the cleanup check silently never ran on
  // exactly the runs that created a fixture. A pre-existing application must still be back
  // at its original stage.
  const appOk = FIXTURE_CREATED.application ? finalApp === null : finalApp?.stage === app.stage;
  const profileOk =
    finalProfile?.first_name === profileBefore.first_name &&
    finalProfile?.last_name === profileBefore.last_name &&
    finalProfile?.display_name === profileBefore.display_name &&
    finalProfile?.status === profileBefore.status;
  const ok =
    JSON.stringify(finalRoles) === JSON.stringify(originalCodes) &&
    finalMembership.membership_type === membership.membership_type &&
    finalMembership.status === membership.status &&
    appOk &&
    profileOk &&
    finalEmployees.length === employeesBefore.length;
  check(
    "this run left recruitment exactly as it found it",
    ok,
    [
      `roles [${finalRoles.join(",")}] (was [${originalCodes.join(",")}])`,
      `type=${finalMembership.membership_type}`,
      `status=${finalMembership.status}`,
      `application=${finalApp ? `stage=${finalApp.stage}` : "deleted (was this run's fixture)"}`,
      `profile=${finalProfile?.display_name} / ${finalProfile?.status} (was ${profileBefore.display_name} / ${profileBefore.status})${profileOk ? "" : " MISMATCH"}`,
      `employees ${employeesBefore.length} -> ${finalEmployees.length}`,
    ].join(", "),
  );

  // Repair the fault injection AFTER the check has read the dirty value. This keeps the
  // flag honest: it proves the check can fail without requiring a second run to clean up,
  // and it means demonstrating a red result never leaves the demo account renamed.
  if (process.argv.includes("--skip-profile-restore")) {
    const { error } = await db
      .from("profiles")
      .update({
        first_name: profileBefore.first_name,
        last_name: profileBefore.last_name,
        display_name: profileBefore.display_name,
        status: profileBefore.status,
      })
      .eq("id", profileBefore.id);
    console.log(`cleanup: fault injection undone, profile repaired${error ? ` FAILED ${error.message}` : ""}`);
  }
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
  await fillHeld(page, page.locator('input[type=email]'), "hr@demo.beepabpo.com");
  await fillHeld(page, page.locator('input[type=password]'), env.DEMO_PASSWORD);
  // Wait for the OUTCOME, not a duration: the session existing, or the form
  // publishing why not. The fixed sleep this replaced decided `check(...url())`
  // by how busy the machine happened to be.
  await submitAndWaitOutcome(page, 'button[type=submit]', { loginPath: "/login", timeout: 25000 });
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  check("signed in as HR (the role that can actually hire)", page.url().includes("/app"), page.url());

  await page.goto(`${BASE}/app/recruitment/applicants/${app.id}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const h1 = await page.locator("h1").first().textContent().catch(() => "");
  check("applicant page loads", h1?.includes(demoApplicant.last_name ?? "?"), `"${(h1 ?? "").trim()}"`);

  // ---- separation of duties: Recruiter must not be able to hire ----
  //
  // The page renders the Hire button only when `canAll(permissions, ["recruitment.manage",
  // "employees.manage"])` is true. Recruiter holds the first and not the second, so the
  // button should be ABSENT -- not present and failing. This assertion existed in the QA
  // report as a claim ("asserted here so a future permission change is noticed") while no
  // script actually checked it: the hire pass only ever signed in as HR.
  //
  // A SEPARATE BrowserContext is mandatory. Pages in one browser share localStorage, and
  // Supabase keeps the session under `sb-<ref>-auth-token`, so signing Recruiter in on the
  // HR page would overwrite the session and every later assertion would run as Recruiter.
  // That mistake produces 28 confident wrong results rather than an error.
  const recruiterCtx = await browser.newContext();
  const recruiterPage = await recruiterCtx.newPage();
  try {
    await recruiterPage.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await fillHeld(recruiterPage, recruiterPage.locator('input[type=email]'), "recruiter@demo.beepabpo.com");
    await fillHeld(recruiterPage, recruiterPage.locator('input[type=password]'), env.DEMO_PASSWORD);
    await submitAndWaitOutcome(recruiterPage, 'button[type=submit]', { loginPath: "/login", timeout: 25000 });
    await recruiterPage.waitForLoadState("domcontentloaded").catch(() => {});
    check("signed in as Recruiter (the role that cannot hire)", recruiterPage.url().includes("/app"), recruiterPage.url());

    await recruiterPage.goto(`${BASE}/app/recruitment/applicants/${app.id}`, { waitUntil: "domcontentloaded" });
    await recruiterPage.waitForTimeout(3000);

    // Identity assertion before trusting any role-based result read off this page.
    //
    // This reads the COOKIE, and that detail is the whole point. Two earlier versions read
    // localStorage and returned `null` against a page that was plainly signed in -- because
    // this app is server-rendered with `@supabase/ssr` and keeps the session in the
    // `sb-<ref>-auth-token` COOKIE. localStorage is genuinely empty here, so an
    // identity guard built on it is not a weak guard, it is a broken one: it returns null
    // whether the page is correct or the harness is wrong, and so cannot tell those apart.
    // `qa-probe-session-identity.mjs` dumped localStorage (empty), the cookie (present, with
    // the right email for both roles) and the rendered header before this was written.
    //
    // `.cookies()` is read from the CONTEXT, not the page, so it is this Recruiter's own
    // session and cannot be confused with the HR context sitting open alongside it.
    const recruiterCookies = await recruiterCtx.cookies();
    const authCookie = recruiterCookies.find((c) => /^sb-.*-auth-token$/.test(c.name));
    let recruiterEmail = null;
    if (authCookie) {
      let raw = authCookie.value;
      try {
        raw = decodeURIComponent(raw);
        if (raw.startsWith("base64-")) raw = Buffer.from(raw.slice(7), "base64").toString("utf8");
      } catch { /* leave the raw value; the JSON.parse below reports the real problem */ }
      try {
        const session = JSON.parse(raw);
        const claims = session?.access_token
          ? JSON.parse(Buffer.from(String(session.access_token).split(".")[1], "base64").toString("utf8"))
          : null;
        recruiterEmail = session?.user?.email ?? claims?.email ?? null;
      } catch { recruiterEmail = null; }
    }
    // `--identity-canary` asserts the WRONG identity on purpose. It is how this check earned
    // the right to be trusted: a guard that has never been seen red is decoration. The probe
    // below was fixed once already because it returned null against a correctly signed-in
    // page, so it gets held to the same standard as everything else here.
const CANARY = process.argv.includes("--identity-canary");
const EXPECTED_RECRUITER = CANARY ? "hr@demo.beepabpo.com" : "recruiter@demo.beepabpo.com";
    check(
      CANARY ? "identity canary (must FAIL - wrong expectation on purpose)" : "the Recruiter page really is the Recruiter",
      recruiterEmail === EXPECTED_RECRUITER,
      `session email=${recruiterEmail}, expected=${EXPECTED_RECRUITER}`,
    );

    const recruiterHire = recruiterPage.locator('button:has-text("create employee")');
    check("Recruiter does NOT see the Hire button", (await recruiterHire.count()) === 0,
      `buttons: ${(await recruiterPage.$$eval("button", (els) => els.map((e) => (e.textContent ?? "").trim()).filter(Boolean))).slice(0, 4).join(" | ")}`);

    // Recruiter DOES hold recruitment.manage, so the pipeline control must be there. This
    // is what makes the previous assertion meaningful: absent Hire + present stage form
    // is a permission boundary, whereas absent everything would just be a broken page.
    check("Recruiter still sees the stage control", (await recruiterPage.locator(`#application-stage-${app.id}`).count()) > 0);

    // The contexts must hold DIFFERENT sessions. If they shared one, every role assertion
    // below would be measuring whichever account signed in last -- which is how a single
    // shared browser once produced 28 confident wrong results against a working app.
    const hrCookies = await ctx.cookies();
    const hrAuth = hrCookies.find((c) => /^sb-.*-auth-token$/.test(c.name));
    let hrEmail = null;
    if (hrAuth) {
      try {
        let raw = decodeURIComponent(hrAuth.value);
        if (raw.startsWith("base64-")) raw = Buffer.from(raw.slice(7), "base64").toString("utf8");
        const session = JSON.parse(raw);
        hrEmail = session?.user?.email ??
          (session?.access_token
            ? JSON.parse(Buffer.from(String(session.access_token).split(".")[1], "base64").toString("utf8"))?.email
            : null);
      } catch { hrEmail = null; }
    }
    check(
      "the HR and Recruiter sessions are separate",
      hrEmail === "hr@demo.beepabpo.com" && recruiterEmail === "recruiter@demo.beepabpo.com" && hrEmail !== recruiterEmail,
      `hr=${hrEmail} recruiter=${recruiterEmail}`,
    );
  } finally {
    await recruiterCtx.close().catch(() => {});
  }

  // ---- stage movement ----
  // Choosing a stage opens a "Move stage" confirmation. Selecting the option and
  // moving on changes nothing, and the open dialog's overlay then intercepts
  // every later click — which is exactly how the first two runs of this script
  // failed, one as a confusing Playwright "element intercepts pointer events".
  const stageSel = page.locator(`#application-stage-${app.id}`);
  check("stage selector present", await stageSel.count() > 0);
  await stageSel.selectOption(FIXTURE_OFFER_STAGE);
  await page.waitForTimeout(900);
  const stageDialog = page.locator('[role="dialog"]').last();
  check("stage change asks for confirmation", await stageDialog.count() > 0,
    (await stageDialog.innerText().catch(() => "")).slice(0, 60).replace(/\s+/g, " "));
  await stageDialog.getByRole("button", { name: "Move stage" }).last().click();
  await page.waitForTimeout(4500);

  const moved = await mustOne(db.from("job_applications").select("stage").eq("id", app.id).maybeSingle(), "stage read");
  check("stage moved to offer", moved?.stage === FIXTURE_OFFER_STAGE, `stage=${moved?.stage} (from ${FIXTURE_START_STAGE})`);

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

  const afterApp = await mustOne(db.from("job_applications").select("stage").eq("id", app.id).maybeSingle(), "app after");
  check("application is now hired", afterApp?.stage === "hired", `stage=${afterApp?.stage}`);

  const auditRows = await must(db.from("audit_logs").select("action").eq("entity_id", app.id), "audit");
  check("hire is audit-logged", auditRows.length > 0, JSON.stringify(auditRows.map((r) => r.action)));

  check("no console errors during the hire", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  await ctx.close();
} finally {
  // A cleanup failure is a RESULT, not a log line. Recording it through `check()` puts it
  // in the tally and forces a non-zero exit; leaving it to `console.error` is what let a
  // run with broken cleanup report a clean sheet.
  await restore().catch((e) => {
    console.error("restore failed:", e.message);
    check("cleanup ran to completion", false, e.message);
  });
  await browser.close().catch(() => {});
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}
}

// The exercise body used to be top-level `await`, so ANY throw rejected the module and Node
// tore down the process while undici and Playwright handles were still closing:
//   Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76
// That native abort replaced the real error message and returned exit code 3221226505, which
// is why an ordinary "table does not exist" kept reading as a Node bug. It is not specific to
// `process.exit()` -- it reproduced on a throw from a script that never launched a browser.
// Catching here keeps the failure on the normal exit path, so the message survives and the
// process drains its handles instead of racing them.
//
// This handler is also the backstop for the one window `restore()` cannot cover: a failure
// during target resolution, before the exercise's try/finally is ever entered.
main().catch(async (err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));

  const rolled = [];
  if (FIXTURE_CREATED.application) {
    const { error } = await db.from("job_applications").delete().eq("id", FIXTURE_CREATED.application);
    rolled.push(`application ${FIXTURE_CREATED.application}${error ? ` FAILED ${error.message}` : ""}`);
  }
  if (FIXTURE_CREATED.applicant) {
    const { error } = await db.from("applicants").delete().eq("id", FIXTURE_CREATED.applicant);
    rolled.push(`applicant ${FIXTURE_CREATED.applicant}${error ? ` FAILED ${error.message}` : ""}`);
  }
  console.log(rolled.length ? `rollback: ${rolled.join(", ")}` : "rollback: nothing was seeded");

  process.exitCode = 1;
});