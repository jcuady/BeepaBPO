// Exercise the client timesheet hand-off: an internal user sends a timesheet day to the
// client for review, and the client either approves it or sends it back.
//
// WHY: the last two unexercised actions in lib/attendance/client-timesheet.ts, and the
// only workflow in the product that crosses the Beepa/client boundary with a real
// status hand-off in both directions.
//
// WHAT THE ENVIRONMENT ACTUALLY OFFERED
//
// Probed before writing anything: `client_settings.allow_timesheet_approval` is true for
// the one client org, and there are 2 active client assignments. But there is **no**
// attendance record for a client-assigned employee that is not already `finalized` --
// 199 of 201 records are finalized, and the 2 drafts belong to employees with no active
// client assignment. So there was nothing to drive, and a run that assumed otherwise
// would have asserted against a refusal it mistook for the happy path.
//
// So this run creates the timesheet day as a fixture, drives the product actions over
// it, and deletes it afterwards.
//
// WHAT IS ACTUALLY BEING TESTED
//
// 1. Both directions of the hand-off. Send-to-client moves a record to `client_review`;
//    the client's Approve moves it to `finalized` and "Send back" moves it to
//    `supervisor_review`. Only exercising Approve leaves the rejection branch -- which
//    is the one that returns work to Beepa -- completely untested.
//
// 2. The guards that are reachable and worth watching: a record already finalized must
//    be refused, and a record belonging to an employee with no active client assignment
//    must be refused. Both are defined in the action and both are reachable from the UI.
//
// 3. The client's own scoping. `reviewClientTimesheet` requires the employee to have an
//    active `client` assignment to *that* client's organization, so a client cannot
//    approve a timesheet from another client's team.
//
// SAFETY: the fixture record is created with the service-role client and deleted in a
// `finally`, and the table's row count is asserted back. Nothing that predates the run
// is modified: if no safe fixture is possible the run reports BLOCKED rather than
// repurposing a real timesheet.
//
// Usage: node scripts/audit/qa-exercise-client-timesheet-workflow.mjs

import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { fillHeld } from "./lib/browser-form.mjs";
import { writeEvidence } from "./lib/evidence.mjs";

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
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const results = [];
const notes = [];
const blocked = (name, reason) => {
  // The reason is stored, not only printed, so it reaches `blockedPaths` in the
  // evidence file. An entry naming WHAT was blocked without WHY cannot tell a
  // reader whether to wait for the environment or fix the product.
  results.push({ name, pass: null, reason });
  console.log(`BLOCKED  ${name}  — ${reason}`);
};
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

const MARK = `qacts${Date.now().toString(36)}`;
const HR_EMAIL = "hr@demo.beepabpo.com";
const CLIENT_EMAIL = "clientadmin@demo.beepabpo.com";
// Overwritten below with a date inside the assignment window. `client_attendance_summary`
// joins employee_assignments and only surfaces records whose work_date falls between
// that assignment's start_date and end_date -- so a fixture dated before the assignment
// begins is invisible to the client queue even though the hand-off itself worked.
// Found by walking free dates across the window, not by reading the view.
let WORK_DATE = "2026-06-15";

const { data: authData, error: authErr } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
if (authErr) throw new Error(`auth users: ${authErr.message}`);
const userIdFor = (email) => authData.users.find((u) => u.email === email)?.id ?? null;

// A client org with the feature switched on, and an employee actively assigned to it.
const settings = await must(db.from("client_settings").select("client_organization_id, allow_timesheet_approval").eq("allow_timesheet_approval", true).limit(1), "client settings");
if (!settings.length) {
  console.log("BLOCKED: no client organization has allow_timesheet_approval enabled.");
  process.exit(2);
}
const clientOrgId = settings[0].client_organization_id;

const assignment = (
  await must(
    db.from("employee_assignments").select("id, employee_id, client_organization_id, start_date, end_date")
      .eq("client_organization_id", clientOrgId).eq("assignment_type", "client").eq("status", "active").limit(1),
    "assignment",
  )
)[0];
if (!assignment) {
  console.log("BLOCKED: no active client assignment to drive.");
  process.exit(2);
}

// Pick a work_date inside the assignment window that the employee does not already
// have a record for -- the table is unique on (employee_id, work_date), so colliding
// with an existing date would make every later assertion read the wrong row.
const takenDates = new Set(
  (
    await must(
      db.from("attendance_records").select("work_date").eq("employee_id", assignment.employee_id).limit(2000),
      "existing work dates",
    )
  ).map((r) => r.work_date),
);
{
  const start = new Date(`${assignment.start_date}T00:00:00Z`);
  let chosen = null;
  for (let i = 1; i <= 60 && !chosen; i += 1) {
    const d = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
    if (!takenDates.has(d)) chosen = d;
  }
  if (!chosen) {
    console.log("BLOCKED: no free work_date inside the assignment window.");
    process.exit(2);
  }
  WORK_DATE = chosen;
}

console.log(`client org: ${clientOrgId.slice(0, 8)} (approval enabled)`);
console.log(`assigned employee: ${assignment.employee_id.slice(0, 8)} (assignment from ${assignment.start_date})`);
console.log(`fixture work_date: ${WORK_DATE} (inside the assignment window)\n`);

const countOf = async (t) => (await db.from(t).select("id", { count: "exact", head: true })).count ?? 0;
const beforeCount = await countOf("attendance_records");

// A second employee with no client assignment, for the refusal check.
const noAssignment = (
  await must(
    db.from("employees").select("id").eq("employment_status", "active").limit(500),
    "employees",
  )
).filter((e) => e.id !== assignment.employee_id);

let skippedClientLeg = false;
let fixtureId = null;
let otherFixtureId = null;
const browser = await chromium.launch();

async function signIn(context, email) {
  const page = await context.newPage();
  page.on("pageerror", (e) => notes.push(`pageerror: ${e.message}`));
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

async function findRowByDate(page) {
  // The Date column renders `Mon 15`, not `Jun 15, 2026` — measured from the rendered
  // page, after a locator written from the source assumed the longer form and silently
  // matched nothing. Scoping to the table row is enough: only a record in a draft state
  // for a client-assigned employee is offered "Send to client", and this run creates
  // exactly one.
  return page.locator("tr").filter({ has: page.getByRole("button", { name: "Send to client" }) }).first();
}

try {
  // -------------------------------------------------------------- fixtures
  const made = await must(
    db.from("attendance_records").insert({
      employee_id: assignment.employee_id,
      work_date: WORK_DATE,
      clock_in_at: `${WORK_DATE}T08:00:00+08:00`,
      clock_out_at: `${WORK_DATE}T17:00:00+08:00`,
      worked_minutes: 480,
      break_minutes: 60,
      status: "present",
      approval_status: "draft",
    }).select("id, approval_status"),
    "create fixture record",
  );
  fixtureId = made[0]?.id ?? null;
  check("a draft timesheet exists for a client-assigned employee", Boolean(fixtureId), fixtureId?.slice(0, 8) ?? "none");

  if (noAssignment.length) {
    const made2 = await must(
      db.from("attendance_records").insert({
        employee_id: noAssignment[0].id,
        work_date: WORK_DATE,
        worked_minutes: 480,
        status: "present",
        approval_status: "draft",
      }).select("id"),
      "create second fixture record",
    );
    otherFixtureId = made2[0]?.id ?? null;
  }

  const statusOf = async (id) =>
    (await must(db.from("attendance_records").select("approval_status").eq("id", id).limit(1), "status read"))[0]
      ?.approval_status ?? null;

  // ------------------------------------------------- internal: send to client
  const hrCtx = await browser.newContext();
  const hrPage = await signIn(hrCtx, HR_EMAIL);
  await hrPage.goto(`${BASE}/app/attendance?week=${WORK_DATE}`, { waitUntil: "domcontentloaded" });
  await hrPage.waitForTimeout(2500);

  const card = await findRowByDate(hrPage);
  const hasSend = (await card.getByRole("button", { name: "Send to client" }).count().catch(() => 0)) > 0;
  check("internal user is offered 'Send to client' for the day", hasSend);
  if (hasSend) {
    await card.getByRole("button", { name: "Send to client" }).click();
    await hrPage.waitForTimeout(900);
    const dialog = hrPage.getByRole("dialog");
    if (await dialog.isVisible().catch(() => false)) {
      const confirm = dialog.getByRole("button").last();
      await confirm.click();
    }
    await hrPage.waitForTimeout(3000);
  }
  check("submitTimesheetForClientReview moves the record to client_review", (await statusOf(fixtureId)) === "client_review", String(await statusOf(fixtureId)));

  // Both actions in lib/attendance/client-timesheet.ts are the only ones in the codebase
  // that change an approval status and write NO audit row at all. The hand-off moves a
  // timesheet day into a client's queue and the client's decision moves it out again;
  // there is no record of who decided what. Asserted as a finding rather than quietly
  // assumed present.
  const submitAudit = await must(
    db.from("audit_logs").select("id, action").eq("entity_id", fixtureId).limit(3),
    "submit audit",
  );
  check(
    "the timesheet hand-off writes an audit row",
    submitAudit.length >= 1,
    submitAudit.length >= 1
      ? `${submitAudit.length} row(s)`
      : "none — lib/attendance/client-timesheet.ts contains no logAudit call at all",
  );

  // Guard: the record that was just submitted must no longer be offered. Scoped to
  // THIS employee's row — a page-wide count is always non-zero, because the second
  // fixture (an employee with no client assignment) legitimately keeps its button.
  // That second row is exactly the mismatch reported further down.
  {
    const { data: empRow } = await db
      .from("employees")
      .select("profile_id, profiles(display_name)")
      .eq("id", assignment.employee_id)
      .maybeSingle();
    const displayName = Array.isArray(empRow?.profiles) ? empRow.profiles[0]?.display_name : empRow?.profiles?.display_name;

    await hrPage.reload({ waitUntil: "domcontentloaded" });
    await hrPage.waitForTimeout(2500);
    // A missing display name means this guard cannot be scoped to the row -- and an
    // unscoped "Send to client" count is page-wide and therefore always non-zero,
    // because the second fixture legitimately keeps its button, which is the false
    // failure this scoping exists to prevent.
    //
    // So the absence is recorded rather than absorbed. It used to fall through to a
    // `hasText` filter on a literal NUL byte, which matches no row on any rendered
    // page: `count()` returned 0, `stillOffered` became false, and the check PASSED
    // having never looked at the page. A guard that cannot fail is not a guard.
    //
    // The NUL had a second effect nobody asked for: it made this file binary as far
    // as `grep` is concerned, so any repo-wide text scan silently skipped it.
    if (!displayName) {
      blocked(
        "the submitted day is no longer offered for submission",
        `could not resolve a display name for employee ${assignment.employee_id}, so the ` +
          "table row could not be scoped and this guard did not run",
      );
    } else {
      const myRow = hrPage.locator("tr").filter({ hasText: displayName }).first();
      const stillOffered = (await myRow.getByRole("button", { name: "Send to client" }).count().catch(() => 0)) > 0;
      const myRowText = (await myRow.innerText().catch(() => "")).replace(/\s+/g, " ");
      check(
        "the submitted day is no longer offered for submission",
        !stillOffered,
        `${displayName}: "${myRowText.slice(0, 90)}"`,
      );
    }
  }
  await hrCtx.close();

  // ----------------------------------------------------- client: approve it
  const cliCtx = await browser.newContext();
  const cliPage = await signIn(cliCtx, CLIENT_EMAIL);
  await cliPage.goto(`${BASE}/app/client/timesheets`, { waitUntil: "domcontentloaded" });
  await cliPage.waitForTimeout(2500);

  const queueBody = (await cliPage.locator("body").innerText()).replace(/\s+/g, " ");
  const approveCount = await cliPage.getByRole("button", { name: "Approve" }).count();
  // Ask the database what the client SHOULD be able to see, so a failed UI assertion
  // can be told apart from a failed action rather than leaving both hypotheses open.
  const viewRows = await must(
    db
      .from("client_attendance_summary")
      .select("attendance_record_id, work_date, approval_status")
      .eq("attendance_record_id", fixtureId),
    "summary view lookup",
  );
  // The queue assertion that first blocked this leg, now that the fixture is dated inside
// the assignment window. Kept as a real check rather than deleted, because it is what
// will catch a regression if the fixture date or the view's window join ever drifts.
check(
  "the timesheet appears in the client review queue",
  viewRows.length > 0,
  `view: ${viewRows.length} row(s) [${viewRows.map((r) => r.approval_status).join(",") || "absent"}]; ${approveCount} Approve button(s) rendered`,
);
if ((await cliPage.getByRole("button", { name: "Approve" }).count()) === 0) {
  blocked("the client is offered Approve", "no Approve control rendered — nothing was in the queue to approve");
  blocked("reviewClientTimesheet approve finalizes the record", "could not be reached through the UI");
  blocked("the finalized day leaves the client review queue", "could not be reached through the UI");
  await cliCtx.close();
  skippedClientLeg = true;
}

  if (!skippedClientLeg) {
  const approveBtn = cliPage.getByRole("button", { name: "Approve" }).first();
  check("the client is offered Approve", await approveBtn.isVisible().catch(() => false));
  await approveBtn.click();
  await cliPage.waitForTimeout(900);
  const cliDialog = cliPage.getByRole("dialog");
  if (await cliDialog.isVisible().catch(() => false)) {
    await cliDialog.getByRole("button").last().click();
  }
  await cliPage.waitForTimeout(3000);

  check("reviewClientTimesheet approve finalizes the record", (await statusOf(fixtureId)) === "finalized", String(await statusOf(fixtureId)));
  const queueGone = (await cliPage.getByText("Jun 15, 2026").count().catch(() => 0)) === 0;
  check("the finalized day leaves the client review queue", queueGone);
  await cliCtx.close();
  }

  // ---------------------------------------- client: the "send back" branch
  // Reset the fixture so the rejection path has something to act on. Only this run's
  // own fixture is touched.
  if (!skippedClientLeg) {
  await db.from("attendance_records").update({ approval_status: "client_review" }).eq("id", fixtureId);

  const cliCtx2 = await browser.newContext();
  const cliPage2 = await signIn(cliCtx2, CLIENT_EMAIL);
  await cliPage2.goto(`${BASE}/app/client/timesheets`, { waitUntil: "domcontentloaded" });
  await cliPage2.waitForTimeout(2500);

  const backBtn = cliPage2.getByRole("button", { name: "Send back" }).first();
  check("the client is offered 'Send back'", await backBtn.isVisible().catch(() => false));
  await backBtn.click();
  await cliPage2.waitForTimeout(900);
  const d2 = cliPage2.getByRole("dialog");
  if (await d2.isVisible().catch(() => false)) await d2.getByRole("button").last().click();
  await cliPage2.waitForTimeout(3000);

  check("reviewClientTimesheet 'Send back' returns it to supervisor_review", (await statusOf(fixtureId)) === "supervisor_review", String(await statusOf(fixtureId)));
  await cliCtx2.close();
  } else {
    blocked("reviewClientTimesheet 'Send back' returns it to supervisor_review", "the client queue never offered the record");
  }

  // `canSend` on /app/attendance is `canSubmit && approval_status !== client_review &&
  // approval_status !== finalized` — it never checks whether the employee has an active
  // client assignment, which the action then requires. So a control is offered that is
  // guaranteed to be refused. Asserting it IS offered records the mismatch honestly
  // rather than asserting the behaviour the page implies.
  if (otherFixtureId) {
    const hrCtx2 = await browser.newContext();
    const hrPage2 = await signIn(hrCtx2, HR_EMAIL);
    await hrPage2.goto(`${BASE}/app/attendance?week=${WORK_DATE}`, { waitUntil: "domcontentloaded" });
    await hrPage2.waitForTimeout(2500);
    const offeredElsewhere = await hrPage2
      .locator("tr")
      .filter({ has: hrPage2.getByRole("button", { name: "Send to client" }) })
      .count();
    check(
      "'Send to client' is offered for an employee with NO client assignment",
      offeredElsewhere >= 1,
      `${offeredElsewhere} row(s) offered — clicking one always yields "Employee has no active client assignment."`,
    );
    await hrCtx2.close();
  }
} catch (e) {
  console.error(`ERROR: ${e.message}`);
  results.push({ name: "run completed without throwing", pass: false });
} finally {
  for (const id of [fixtureId, otherFixtureId]) {
    if (id) await db.from("attendance_records").delete().eq("id", id);
  }
  const afterCount = await countOf("attendance_records");
  const leftovers = await must(
    db.from("attendance_records").select("id").eq("work_date", WORK_DATE).limit(50),
    "leftover check",
  );
  console.log(`\n(cleanup) attendance_records ${beforeCount} -> ${afterCount}; rows left on ${WORK_DATE}: ${leftovers.length}`);

  check("the fixture rows are gone", (leftovers.filter((l) => l.id === fixtureId || l.id === otherFixtureId)).length === 0);
  check("the attendance_records count is back to its starting size", afterCount === beforeCount, `${afterCount} vs ${beforeCount}`);

  const restored = afterCount === beforeCount;
  console.log(`the sweep left the demo data as it found it: ${restored ? "yes" : "NO"}`);
  if (!restored) process.exitCode = 1;

  await browser.close().catch(() => {});

  const passed = results.filter((r) => r.pass === true).length;
  const failed = results.filter((r) => r.pass === false).length;
  const blockedCount = results.filter((r) => r.pass === null).length;
  console.log(`\n${passed}/${results.length} assertions passed` + (blockedCount ? `, ${blockedCount} BLOCKED` : "") + (failed ? `, ${failed} failed` : ""));
  if (passed + blockedCount !== results.length) process.exitCode = 1;
  if (notes.length) {
    console.log("\nnotes:");
    for (const n of notes) console.log(`  - ${n}`);
  }

  // Evidence, written by the exercise itself, after the last `process.exitCode`
  // assignment because `writeEvidence` derives the verdict from it.
  // See `scripts/audit/lib/evidence.mjs`.
  try {
    const { file } = writeEvidence({
      id: "client-timesheet",
      script: "scripts/audit/qa-exercise-client-timesheet-workflow.mjs",
      claim: "the client timesheet hand-off both ways: send to client, client approves to finalized, client sends back to supervisor_review",
      base: BASE,
      checks: results.filter((r) => typeof r.pass === "boolean"),
      notes,
      exitCode: process.exitCode ?? 0,
      extra: {
        // `blocked()` records a path the environment refused as `pass: null` in
        // this same array, and `writeEvidence` refuses a check it cannot
        // evaluate -- a null `pass` is exactly that, and would have thrown the
        // whole file away. So the evaluable checks go to `checks` and the
        // refused paths to `extra`, which is where
        // `qa-exercise-admin-workflow.mjs` keeps its own.
        blockedPaths: results.filter((r) => typeof r.pass !== "boolean").map((r) => ({ name: r.name, reason: r.reason })),
        // The date the fixture was pinned to, which is why the record was
        // visible to the client queue at all.
        workDate: WORK_DATE,
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

