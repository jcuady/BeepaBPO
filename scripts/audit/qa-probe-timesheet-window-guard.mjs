// Drive the client-timesheet window guard through the real UI, not through its source text.
//
// WHY THIS EXISTS
// `tests/client-timesheet-approval.test.ts` asserts the guard is PRESENT in
// `submitTimesheetForClientReview`. That catches a deleted guard but not a wrong one, and
// it cannot prove the ordering claim that matters most: that the window check runs BEFORE
// the write to `client_review`. A guard that checked after the update would leave the
// record in the client's queue anyway and pass every source assertion.
//
// So this drives the actual button. It seeds an attendance record dated before the
// employee's client assignment start, clicks "Send to client", confirms, and asserts:
//
//   1. the UI refuses, with a message naming the window
//   2. the record's approval_status is UNCHANGED -- the ordering claim, observed
//   3. the record is still absent from what the client can see
//
// A control runs first: a record dated INSIDE the window must still submit successfully,
// so a pass cannot be explained by the button being broken or the fixture being invalid.
//
// SAFETY
// The fixture is created with a unique marker and deleted in `finally`. No seeded row is
// read for anything other than its id, and nothing is modified except the fixture's own
// approval_status -- which the control deliberately flips and the guard leg must leave
// alone.
//
// Usage: node scripts/audit/qa-probe-timesheet-window-guard.mjs

import { readFileSync } from "node:fs";
import { fillHeld } from "./lib/browser-form.mjs";
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
const MARK = `qawin${Date.now().toString(36)}`;
const EMAIL = "hr@demo.beepabpo.com"; // holds attendance.manage / attendance.correct

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  - ${detail}` : ""}`);
}
const note = (m) => console.log(`NOTE  ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}

// An assignment whose start_date is set and in the past, so "10 days before start" is a
// date the guard must reject while still being a plausible work date.
const assignments = await must(
  db.from("employee_assignments")
    .select("employee_id, client_organization_id, start_date, end_date, status")
    .eq("assignment_type", "client")
    .eq("status", "active")
    .not("client_organization_id", "is", null)
    .not("start_date", "is", null),
  "assignments",
);
const assignment = assignments.find((a) => a.start_date && a.start_date < new Date().toISOString().slice(0, 10));
if (!assignment) throw new Error("no active client assignment with a past start_date; cannot build the fixture");

const startDate = assignment.start_date;
// attendance_records is UNIQUE on (employee_id, work_date), so a fixture cannot reuse a
// seeded day. Search outward from the ideal dates for one that is free, on the correct
// side of the boundary, rather than failing on the first collision.
const taken = new Set((await must(
  db.from("attendance_records").select("work_date").eq("employee_id", assignment.employee_id),
  "existing dates",
)).map((r) => r.work_date));

const today = new Date().toISOString().slice(0, 10);
function freeDate(startOffsetDays, direction) {
  for (let step = 0; step < 60; step++) {
    const offset = startOffsetDays + direction * step;
    const d = new Date(new Date(startDate).getTime() + offset * 86400000).toISOString().slice(0, 10);
    if (!taken.has(d) && d <= today) return d;
  }
  throw new Error(`no free attendance date found ${direction < 0 ? "before" : "after"} ${startDate}`);
}
const outsideDate = freeDate(-10, -1);
const insideDate = freeDate(10, 1);
if (insideDate <= startDate || outsideDate >= startDate) {
  throw new Error(`date selection went wrong: outside=${outsideDate} start=${startDate} inside=${insideDate}`);
}
note(`employee ${assignment.employee_id.slice(0, 8)}  assignment ${startDate} .. ${assignment.end_date ?? "open"}`);
note(`fixture: outside=${outsideDate}  control(inside)=${insideDate}`);

async function seed(date) {
  return (await must(
    db.from("attendance_records").insert({
      employee_id: assignment.employee_id,
      work_date: date,
      status: "present",
      worked_minutes: 480,
      break_minutes: 60,
      late_minutes: 0,
      overtime_minutes: 0,
      undertime_minutes: 0,
      approval_status: "supervisor_review",
      shift_assignment_id: null,
      clock_in_at: `${date}T09:00:00.000Z`,
      clock_out_at: `${date}T18:00:00.000Z`,
    }).select("id, work_date, approval_status").limit(1),
    "seed attendance record",
  ))[0];
}

/**
 * Click "Send to client" on the row for `date` and return whatever toast appeared.
 *
 * The page has TWO views. The default is a heatmap: one row per employee, one column per
 * day, a status letter per cell — which has no per-record button at all. `heatmap=0` swaps
 * it for the detailed record table, which is where "Send to client" is rendered. Two runs
 * failed both legs with "row not found" before this was found by dumping the page instead
 * of guessing at the locator.
 *
 * So: `week=<date>` puts the fixture's week on screen, and `heatmap=0` puts it in rows.
 */
// The Date column renders as "Wed 26", NOT the ISO date, so filtering a row by `2026-08-26`
// never matches. Derived here rather than guessed: midday UTC keeps the day-of-week stable
// regardless of the machine's timezone.
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function rowLabel(isoDate) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()}`;
}

async function submitThroughUi(page, date) {
  await page.goto(`${BASE}/app/attendance?week=${date}&heatmap=0`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const label = rowLabel(date);
  const row = page.locator("tr").filter({ hasText: label }).first();
  if (!(await row.count())) {
    // Print what is actually on screen. Guessing at the locator from "not found" is how a
    // harness reports a defect that is not there -- and is how two runs of this script failed
    // before the page was dumped.
    const weekLabel = (await page.locator("body").innerText()).match(/\w{3} \d{1,2}[^\n]*/)?.[0] ?? "(no week label)";
    const rowCount = await page.locator("tr").count();
    const sample = (await page.locator("tr").allInnerTexts()).slice(0, 6).map((t) => t.replace(/\s+/g, " ").slice(0, 90));
    note(`diagnostics for ${date} (looking for "${label}"): heading="${weekLabel}" rows=${rowCount}`);
    for (const s of sample) note(`   row: ${s}`);
    return { clicked: false, toast: "", reason: `row not found (heading="${weekLabel}", ${rowCount} rows on screen)` };
  }
  const button = row.getByRole("button", { name: /send to client/i });
  if (!(await button.count())) return { clicked: false, toast: "", reason: "no Send to client button on the row" };
  await button.first().click();
  await page.waitForTimeout(800);
  const dialog = page.locator("[role=dialog]").getByRole("button", { name: /send to client/i }).last();
  if (await dialog.count()) await dialog.click();
  // The result arrives as a toast. Poll rather than sleep once, so a slow response is not
  // scored as a refusal.
  for (let i = 0; i < 20; i++) {
    const toast = (await page.locator("[data-sonner-toast]").allInnerTexts()).join(" | ").trim();
    if (toast) return { clicked: true, toast };
    await sleep(500);
  }
  return { clicked: true, toast: "", reason: "clicked but no toast appeared within 10s" };
}

let browser;
const created = [];
try {
  browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("input[type=email]").first().waitFor({ state: "visible", timeout: 20000 });
  await fillHeld(page, page.locator("input[type=email]").first(), EMAIL);
  await fillHeld(page, page.locator("input[type=password]").first(), env.DEMO_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/app/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  if (page.url().includes("/login")) throw new Error(`${EMAIL} could not sign in`);

  // ---------- CONTROL: an in-window day must still submit
  const control = await seed(insideDate);
  created.push(control.id);
  const controlResult = await submitThroughUi(page, insideDate);
  const controlStatus = (await must(
    db.from("attendance_records").select("approval_status").eq("id", control.id).limit(1),
    "control status",
  ))[0]?.approval_status;
  check("CONTROL: a day inside the assignment window still submits",
    controlResult.toast.includes("client review") && controlStatus === "client_review",
    `toast="${controlResult.toast.slice(0, 90)}" status=${controlStatus}${controlResult.reason ? ` (${controlResult.reason})` : ""}`);

  // ---------- THE GUARD: an out-of-window day must be refused
  const fixture = await seed(outsideDate);
  created.push(fixture.id);
  const result = await submitThroughUi(page, outsideDate);
  check("an out-of-window day is refused with a message naming the window",
    /never see/i.test(result.toast) && result.toast.includes(startDate),
    `toast="${result.toast.slice(0, 160)}"${result.reason ? ` (${result.reason})` : ""}`);

  // The ordering claim, observed rather than asserted on source.
  const after = (await must(
    db.from("attendance_records").select("approval_status, work_date").eq("id", fixture.id).limit(1),
    "fixture status after refusal",
  ))[0];
  check("the refused record was NOT written to client_review",
    after?.approval_status === "supervisor_review",
    `approval_status=${after?.approval_status} (work_date=${after?.work_date})`);

  // And it is genuinely invisible to the client, which is what the guard is protecting.
  const visible = await must(
    db.from("client_attendance_summary").select("attendance_record_id").eq("attendance_record_id", fixture.id),
    "client view",
  );
  check("the refused record is invisible to the client view, as the guard claims",
    visible.length === 0,
    visible.length ? "it IS visible - the guard is guarding against nothing" : "absent, as the view filter says");
} catch (e) {
  console.error(`\nRUN ERROR: ${e.message}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  for (const id of created) {
    const { error } = await db.from("attendance_records").delete().eq("id", id);
    note(`cleanup ${id.slice(0, 8)}: ${error ? `FAILED ${error.message}` : "deleted"}`);
  }
  const { data: leftover } = await db.from("attendance_records").select("id").eq("employee_id", assignment.employee_id);
  note(`attendance records for this employee now: ${leftover?.length ?? 0}`);
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} assertions passed`);
process.exitCode = process.exitCode || (passed === results.length ? 0 : 1);