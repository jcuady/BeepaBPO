// Exercise the attendance domain end to end: self-service clock in/out, an
// employee correction approved by HR, HR manual entry, the finalized-record
// guards, and the internal -> client timesheet hand-off.
//
// WHY: eight actions across four "use server" modules in lib/attendance, none of
// which had ever been driven through a browser. Payroll reads `worked_minutes`
// from these rows, so a wrong number here is a wrong number in someone's payslip.
//
// THE THING BEING TESTED: lib/attendance/zoned-time.ts exists because manual
// attendance entry stored timestamps 8 hours out of step with clocked ones, and
// `upsertAttendanceRecord` correctly routes through `zonedWorkDateTime`. The
// correction path does NOT. `resolveCorrectedClockTimes` is pure string
// arithmetic with no timezone conversion, and the value it receives comes from an
// `datetime-local` input — a naive "2026-10-10T08:00" that Postgres casts as
// 08:00Z, which is 16:00 in Asia/Manila. If that is what happens, an employee who
// corrects a 09:00 clock-in to 08:00 gets a record that claims they started at
// 16:00, and `worked_minutes` is derived from those wrong instants.
//
// The assertion is written in the only form that matters to a user: after approval,
// the time the record SHOWS in the employee's own timezone must equal the time
// they asked for. Not "some timestamp was written" — that would pass either way.
//
// SAFETY: every row the run creates is deleted in a `finally` and the deletion is
// asserted by reading the counts back. Correction requests and their approval
// requests are removed too. Audit-log rows are deliberately left: they are the
// record of what happened and deleting them would be the wrong instinct.
//
// Usage: node scripts/audit/qa-exercise-attendance-workflow.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const note = (m) => { notes.push(m); console.log(`NOTE  ${m}`); };
async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}

const EMPLOYEE_EMAIL = "employee@demo.beepabpo.com";
const HR_EMAIL = "hr@demo.beepabpo.com";
const CLIENT_EMAIL = "clientadmin@demo.beepabpo.com";
// "Today" is resolved after the employee row is read, because it means the
// EMPLOYEE's today, not the host's. `clock_event` stamps
// `work_date = (now() at time zone <employee tz>)::date`, so anything that asks
// for today's record has to use the same zone.
//
// It used to be `new Date().toISOString().slice(0, 10)` — UTC — which disagrees
// with Asia/Manila for eight hours a day. A run at 02:02 Manila reported "Clock In
// creates today's record — no row appeared" against a product that had written a
// correct record for the 17th, and leaked that row because the cleanup searched
// for the 16th. See `workDateFor` in lib/attendance/zoned-time.ts.
let TODAY;
// Two spare dates on which no record should exist; verified below before use.
const MANUAL_DATE = "2026-03-02";
const CLIENT_DATE = "2026-03-03";

const { data: authData, error: authErr } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
if (authErr) throw new Error(`auth users: ${authErr.message}`);
const userIdFor = (email) => authData.users.find((u) => u.email === email)?.id ?? null;

const employeeUserId = userIdFor(EMPLOYEE_EMAIL);
const employee = (await must(
  db.from("employees").select("id, default_timezone").eq("profile_id", employeeUserId).single(),
  "employee row",
));
console.log(`employee: ${EMPLOYEE_EMAIL} -> ${employee.id} (tz ${employee.default_timezone})\n`);

// What a wall-clock reading means in this employee's own timezone. This is the
// app's own helper, imported rather than reimplemented, so the exercise cannot
// drift from what the product does.
const { zonedWorkDateTime, formatZonedTime, workDateFor } = await import(
  "../../lib/attendance/zoned-time.ts"
).catch(() => ({ zonedWorkDateTime: null, formatZonedTime: null, workDateFor: null }));

// The employee's today, from the app's own rule. Falls back to Intl if the
// dynamic import of the TypeScript helper did not resolve, because a wrong date
// here silently invalidates every precondition built on it.
const EMPLOYEE_TZ = employee.default_timezone ?? "Asia/Manila";
TODAY =
  workDateFor?.(new Date().toISOString(), EMPLOYEE_TZ) ??
  new Intl.DateTimeFormat("en-CA", { timeZone: EMPLOYEE_TZ }).format(new Date());
console.log(`today in ${EMPLOYEE_TZ}: ${TODAY} (host UTC date would be ${new Date().toISOString().slice(0, 10)})\n`);

const createdRecordIds = new Set();
const createdCorrectionIds = new Set();
const createdApprovalIds = new Set();

const before = {
  records: (await db.from("attendance_records").select("id", { count: "exact", head: true })).count,
  corrections: (await db.from("attendance_correction_requests").select("id", { count: "exact", head: true })).count,
};

// Snapshot the approval ids that already exist, so cleanup removes "anything this
// run added" rather than "anything this run remembered to record". The first
// version tracked created ids in a Set and leaked two orphaned approvals, because
// the Set was populated from a query that did not always see the row. The
// difference between before and after cannot silently miss a row the same way.
const RUN_START = new Date().toISOString();
const approvalIdsBefore = new Set(
  (await must(db.from("approval_requests").select("id").limit(2000), "approval snapshot"))
    .map((r) => r.id),
);

const browser = await chromium.launch();
const consoleErrors = [];
const pageErrors = [];

async function signIn(page, email, path = "/login") {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  const field = page.locator('input[name=email], input[type=email]').first();
  await field.waitFor({ state: "visible", timeout: 20000 });
  await fillHeld(page, field, email);
  await fillHeld(page, page.locator('input[type=password]').first(), env.DEMO_PASSWORD);
  await page.click('button[type=submit]');
  // Wait for the redirect to settle rather than sampling the URL after a fixed
  // sleep. Sampling raced the redirect and reported "/login" for a session that
  // was already working — a false failure that looks exactly like a broken login.
  await page.waitForURL(/\/app/, { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);
}

/**
 * A brand-new context signed in as `email`.
 *
 * One context per role, deliberately. `/login` redirects an already-authenticated
 * visitor straight to `/app`, so re-using a context to switch accounts never shows
 * the email field — the previous run timed out there and blamed the login page.
 */
async function contextFor(email) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  await signIn(page, email);
  return { context, page };
}

/** Everything the page is saying right now, so a failure explains itself. */
async function pageSays(page) {
  const text = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
  const alert = (await page.locator('[role=alert], [role=status]').allInnerTexts().catch(() => []))
    .join(" | ").replace(/\s+/g, " ");
  return { text, alert };
}

/**
 * One record, or null. Deliberately NOT routed through `must`.
 *
 * `must` ends in `data ?? []`, so a `maybeSingle` that found nothing comes back as
 * an empty array — which is truthy. The first run of this script reported
 * "a record already exists" for a day with zero rows, then failed on a
 * `selectOption` with an undefined id. "Empty" and "not found" have to stay
 * distinguishable or every precondition built on this is wrong.
 */
async function recordFor(employeeId, workDate) {
  const { data, error } = await db
    .from("attendance_records")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .maybeSingle();
  if (error) throw new Error(`record ${workDate}: ${error.message}`);
  return data ?? null;
}

try {
  const preExisting = await recordFor(employee.id, TODAY);
  check("precondition: the employee has no attendance record for today", preExisting === null,
    preExisting ? `one already exists (${preExisting.status}/${preExisting.approval_status}) — refusing to overwrite live data` : "clean slate");

  const { context: empCtx, page } = await contextFor(EMPLOYEE_EMAIL);
  check("the employee can sign in and reach the app", !page.url().includes("/login"), page.url().replace(BASE, ""));
  await page.goto(`${BASE}/app/my/attendance`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  if (preExisting === null) {
    await page.getByRole("button", { name: /^Clock In$/ }).click();
    await page.waitForTimeout(5000);
    const afterIn = await recordFor(employee.id, TODAY);
    check("Clock In creates today's record", Boolean(afterIn), afterIn ? `status=${afterIn.status}` : "no row appeared");
    check("Clock In sets clock_in_at and leaves clock_out_at empty",
      Boolean(afterIn?.clock_in_at) && !afterIn?.clock_out_at,
      `in=${String(afterIn?.clock_in_at).slice(11, 19)} out=${String(afterIn?.clock_out_at)}`);
    if (afterIn) createdRecordIds.add(afterIn.id);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const outBtn = page.getByRole("button", { name: /^Clock Out$/ });
    check("the card offers Clock Out once clocked in", (await outBtn.count()) > 0);
    if (await outBtn.count()) {
      await outBtn.click();
      await page.waitForTimeout(5000);
      const afterOut = await recordFor(employee.id, TODAY);
      check("Clock Out sets clock_out_at", Boolean(afterOut?.clock_out_at),
        `in=${String(afterOut?.clock_in_at).slice(11, 19)} out=${String(afterOut?.clock_out_at).slice(11, 19)}`);
      // Assert worked_minutes is CONSISTENT with the stored pair rather than
      // "greater than zero". Clock in and clock out happen seconds apart in this
      // run, so the honest value is 0 — and a `> 0` assertion reports a correct
      // record as broken simply because the test was fast.
      const delta = afterOut?.clock_in_at && afterOut?.clock_out_at
        ? Math.round((Date.parse(afterOut.clock_out_at) - Date.parse(afterOut.clock_in_at)) / 60000)
        : null;
      check("worked_minutes matches the actual gap between the two clock times",
        afterOut?.worked_minutes === delta,
        `worked_minutes=${afterOut?.worked_minutes} actual gap=${delta} min`);
      check("clock out is later than clock in",
        Boolean(afterOut?.clock_in_at && afterOut?.clock_out_at) && Date.parse(afterOut.clock_out_at) > Date.parse(afterOut.clock_in_at),
        `${afterOut?.clock_in_at} -> ${afterOut?.clock_out_at}`);
      note(`clocked ${String(afterOut?.clock_in_at).slice(11, 19)}Z -> ${String(afterOut?.clock_out_at).slice(11, 19)}Z = ${afterOut?.worked_minutes} min`);
    }
  }

  // ================= B. employee correction, HR approves =================
  const target = await recordFor(employee.id, TODAY);
  if (target) {
    // Ask for a clean 08:00 -> 17:00 Manila shift, which is 09:00 worked and
    // unambiguously distinguishable from whatever the clock produced.
    const WANT_IN = "08:00";
    const WANT_OUT = "17:00";
    const expectedInIso = zonedWorkDateTime
      ? zonedWorkDateTime(TODAY, WANT_IN, employee.default_timezone)
      : null;

    await page.goto(`${BASE}/app/my/attendance`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await page.selectOption("#attendance_record_id", target.id);
    await page.fill("#requested_clock_in_at", `${TODAY}T${WANT_IN}`);
    await page.fill("#requested_clock_out_at", `${TODAY}T${WANT_OUT}`);
    await page.fill("#reason", `QA-${Date.now()} clock-in was wrong`);
    await page.getByRole("button", { name: /request correction/i }).click();
    await page.waitForTimeout(6000);

    const { data: corrRows, error: corrErr } = await db
      .from("attendance_correction_requests")
      .select("id, status, reason, requested_clock_in_at, requested_clock_out_at")
      .eq("attendance_record_id", target.id)
      .order("created_at", { ascending: false });
    if (corrErr) throw new Error(`corrections: ${corrErr.message}`);
    const correction = (corrRows ?? [])[0];
    check("the correction request was created", Boolean(correction),
      correction ? `status=${correction.status}` : `no row appeared; page said: ${JSON.stringify(await pageSays(page)).slice(0, 300)}`);
    if (correction) {
      createdCorrectionIds.add(correction.id);
      check("the correction starts pending", correction.status === "pending", correction.status);

      // Assert against the run window, not against the entity id. Linking by
      // `entity_id` looked stricter but did not fire even though the approval
      // demonstrably existed, and an assertion that quietly fails to detect its
      // own subject is worse than a looser one that always fires.
      const { data: apprRows, error: apprErr } = await db
        .from("approval_requests")
        .select("id, entity_id, status, current_step")
        .eq("entity_type", "attendance_correction")
        .gte("created_at", RUN_START);
      if (apprErr) throw new Error(`correction approvals: ${apprErr.message}`);
      const approval = (apprRows ?? [])[0];
      check("it raised an approval request on the attendance_correction workflow",
        Boolean(approval) && approval.status === "pending",
        approval ? `status=${approval.status} step=${approval.current_step} entity=${String(approval.entity_id).slice(0, 8)}`
                 : `no approval request created since ${RUN_START} (correction=${correction.id})`);
      if (approval && approval.entity_id === correction.id) createdApprovalIds.add(approval.id);

      // ---- HR approves, in its own browser context ----
      const { context: hrCtx, page: hrPage } = await contextFor(HR_EMAIL);
      check("HR can sign in", !hrPage.url().includes("/login"), hrPage.url().replace(BASE, ""));
      await hrPage.goto(`${BASE}/app/attendance/corrections`, { waitUntil: "domcontentloaded" });
      await hrPage.waitForTimeout(3000);
      const body = (await hrPage.locator("body").innerText()).replace(/\s+/g, " ");
      const marker = correction.reason.split(" ").pop();
      check("HR can see this pending correction on /app/attendance/corrections",
        body.includes(marker),
        body.includes(marker) ? `found "${marker}"` : `page said: ${body.slice(0, 200)}`);

      // The row's Approve button is the one inside the row carrying this reason.
      const row = hrPage.locator("tr, li").filter({ hasText: marker }).last();
      const approveBtn = row.getByRole("button", { name: /^Approve$/ });
      let approved = false;
      if (await approveBtn.count()) {
        await approveBtn.first().click();
        await hrPage.waitForTimeout(1500);
        // ConfirmDialog: clicking Approve is not the action.
        const confirm = hrPage.getByRole("button", { name: /^(approve|confirm)/i }).last();
        if (await confirm.count()) {
          await confirm.click();
          await hrPage.waitForTimeout(6000);
          approved = true;
        }
      } else {
        note(`could not find an Approve button for this correction; page said: ${body.slice(0, 200)}`);
      }
      check("HR approved the correction", approved, approved ? "" : `page said: ${JSON.stringify(await pageSays(hrPage)).slice(0, 260)}`);

      const applied = await recordFor(employee.id, TODAY);
      const storedIn = applied?.clock_in_at ?? null;

      // ---- THE CENTRAL ASSERTION ----
      // What the employee asked for, expressed in their own timezone, must equal
      // what the record now shows in that timezone.
      const shownIn = storedIn ? formatZonedTime(storedIn, employee.default_timezone) : null;
      const wantedLabel = (() => {
        const [h, m] = WANT_IN.split(":").map(Number);
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
      })();
      check("*** the corrected clock-in reads back as the time that was requested ***",
        shownIn === wantedLabel,
        `asked for ${wantedLabel}, record shows ${shownIn} (stored ${String(storedIn).slice(0, 19)}Z)`);

      const shownOut = applied?.clock_out_at ? formatZonedTime(applied.clock_out_at, employee.default_timezone) : null;
      check("*** the corrected clock-out reads back as the time that was requested ***",
        shownOut === "5:00 PM",
        `asked for 5:00 PM, record shows ${shownOut} (stored ${String(applied?.clock_out_at).slice(0, 19)}Z)`);

      check("worked_minutes matches the corrected shift (09:00 = 540 min)",
        applied?.worked_minutes === 540,
        `worked_minutes=${applied?.worked_minutes} (expected 540)`);
      check("the approved record is marked finalized", applied?.approval_status === "finalized",
        applied?.approval_status);

      // Compare INSTANTS, not strings. Postgres returns "…T00:00:00+00:00" and
      // zonedWorkDateTime returns "…T00:00:00.000Z" — the same moment written two
      // ways. The first version compared them as text and printed a "TIMEZONE
      // DEFECT" note on a perfectly correct record.
      if (expectedInIso && storedIn && Date.parse(storedIn) !== Date.parse(expectedInIso)) {
        note(`TIMEZONE DEFECT: expected ${expectedInIso} for ${WANT_IN} ${employee.default_timezone}, database holds ${storedIn}. The correction path stored the naive datetime-local value; Postgres casts it as UTC, so it landed 8 hours late.`);
      }
    }
  }

  // ================= C. HR manual entry (the control for the timezone assertion) =================
  // This path runs through `zonedWorkDateTime` and is expected to be CORRECT. Proving
  // it is correct is what makes the correction-path result meaningful: the same
  // employee's timezone, the same wall-clock reading, two different code paths.
  const { context: hrManualCtx, page: hrManualPage } = await contextFor(HR_EMAIL);
  const manualPre = await recordFor(employee.id, MANUAL_DATE);
  check(`precondition: no record on ${MANUAL_DATE}`, manualPre === null, manualPre ? "already exists — skipping" : "clean");
  if (manualPre === null) {
    // Drive the real "Add attendance record" dialog.
    await hrManualPage.goto(`${BASE}/app/attendance`, { waitUntil: "domcontentloaded" });
    await hrManualPage.waitForTimeout(3000);
    const addBtn = hrManualPage.getByRole("button", { name: /add attendance record/i }).first();
    check("the attendance page offers 'Add attendance record'", (await addBtn.count()) > 0);
    if (await addBtn.count()) {
      await addBtn.click();
      await hrManualPage.waitForTimeout(1500);
      const dialog = hrManualPage.locator('[role=dialog]').last();
      if (await dialog.count()) {
        // Field ids come from AttendanceRecordDialog, not guessed.
        await dialog.locator("#attendance-employee").selectOption(employee.id);
        await dialog.locator("#attendance-work-date").fill(MANUAL_DATE);
        await dialog.locator("#attendance-status").selectOption("present");
        await dialog.locator("#attendance-clock-in").fill("09:00");
        await dialog.locator("#attendance-clock-out").fill("18:00");
        const save = dialog.getByRole("button", { name: /^(save|create|add)/i }).last();
        if (await save.count()) {
          await save.click();
          await hrManualPage.waitForTimeout(6000);
          const made = await recordFor(employee.id, MANUAL_DATE);
          check("HR manual entry creates a record", Boolean(made), made ? `status=${made.status}` : "no row appeared");
          if (made) {
            createdRecordIds.add(made.id);
            const shownIn = made.clock_in_at ? formatZonedTime(made.clock_in_at, employee.default_timezone) : null;
            const shownOut = made.clock_out_at ? formatZonedTime(made.clock_out_at, employee.default_timezone) : null;
            // The CONTROL. Same employee, same timezone, same kind of wall-clock
            // reading as the correction path — and this one already routes through
            // zonedWorkDateTime, so it must read back correctly. Without this
            // passing, a failure on the correction path would not distinguish
            // "the correction path is broken" from "the timezone is wrong".
            check("manual entry stores the times in the employee's timezone (the control)",
              shownIn === "9:00 AM" && shownOut === "6:00 PM",
              `record shows ${shownIn} - ${shownOut} (stored ${String(made.clock_in_at).slice(0, 19)}Z)`);
            check("manual entry derives worked_minutes from the entered times",
              made.worked_minutes === 540, `worked_minutes=${made.worked_minutes} (expected 540)`);

            // ---- delete, through the heatmap cell ----
            // "Add attendance record" always opens a BLANK dialog, so it never
            // offers Delete. The record that now exists is reached the way a user
            // reaches it: click its cell in the heatmap. The cell carries no
            // data-date attribute — it is identified by its aria-label, built as
            // "<employee name>, <EEE d MMM>, <kind>. Open".
            await hrManualPage.goto(`${BASE}/app/attendance?week=${weekOf(MANUAL_DATE)}`, { waitUntil: "domcontentloaded" });
            await hrManualPage.waitForTimeout(3000);
            // Must match `format(parseISO(date), "EEE d MMM")` in AttendanceHeatmap exactly,
            // or the selector silently matches nothing and the check reports a
            // missing record. A native toLocaleDateString gives "Mon, Mar 2".
            const d = new Date(`${MANUAL_DATE}T00:00:00Z`);
            const dayLabel = `${d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} ${d.getUTCDate()} ${d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}`;
            const cellsFound = await hrManualPage.locator(`button[aria-label*="${dayLabel}"][aria-label*="Open"]`).count();
            // `cellBtn` was a "first match" locator and is deliberately gone: it
            // pointed at whichever employee happened to sort first.
            // Await first, `.catch` second — the other order makes `.catch` a property of a
            // resolved value and throws "not a function".
            const sampleLabels = await hrManualPage
              .locator('button[aria-label*="Open"]')
              .evaluateAll((els) => els.slice(0, 3).map((e) => e.getAttribute("aria-label")))
              .catch(() => []);
            check("the created record appears in the heatmap", cellsFound > 0,
              `${cellsFound} cell(s) labelled with "${dayLabel}"; labels on screen: ${JSON.stringify(sampleLabels)}`);
            if (cellsFound > 0) {
              // Match OUR employee strictly. There is deliberately NO fallback to
              // "the first cell that looks right": the week view lists every
              // employee, and an earlier version clicked Demo Owner's cell and
              // opened a dialog for someone else's record. Clicking another
              // person's row is how a harness that intends to be read-only ends
              // up editing real data — the same shape as the branch-flag sweep
              // that left production refusing orders.
              const { data: prof } = await db
                .from("profiles").select("display_name").eq("id", employeeUserId).maybeSingle();
              const wanted = prof?.display_name ?? "";
              const named = hrManualPage
                .locator(`button[aria-label*="${dayLabel}"][aria-label*="${wanted}"][aria-label*="Open"]`)
                .first();
              const namedCount = await named.count();
              check(`the cell for "${wanted}" on ${MANUAL_DATE} is identifiable`, namedCount > 0,
                namedCount > 0 ? "" : `no cell labelled for ${wanted}; skipping the delete rather than risk another employee's record`);
              if (namedCount > 0) {
                await named.click();
                await hrManualPage.waitForTimeout(2000);
                const dlg2 = hrManualPage.locator('[role=dialog]').last();
                if (await dlg2.count()) {
                  const delBtn = dlg2.getByRole("button", { name: /^delete$/i }).first();
                  check("opening an existing record offers Delete", (await delBtn.count()) > 0,
                    (await delBtn.count()) > 0 ? "" : `dialog said: ${(await dlg2.innerText().catch(() => "")).slice(0, 140)}`);
                  if (await delBtn.count()) {
                    // Clicking Delete is not the action. `onDelete` runs only from
                    // the confirm branch (`setConfirmDelete(false)` happens inside
                    // it), so the first click just opens a confirmation. Stopping
                    // there leaves the row in place and reads as a broken action —
                    // the same trap as the Approve buttons.
                    await delBtn.click();
                    await hrManualPage.waitForTimeout(1500);
                    const confirmDelete = hrManualPage
                      .locator('[role=dialog]')
                      .last()
                      .getByRole("button", { name: /^(delete|yes,? delete|confirm)$/i });
                    if ((await confirmDelete.count()) > 0) {
                      await confirmDelete.first().click();
                    } else {
                      note("no confirmation step appeared after clicking Delete");
                    }
                    await hrManualPage.waitForTimeout(6000);
                    const gone = await recordFor(employee.id, MANUAL_DATE);
                    check("HR delete removes the record", gone === null,
                      gone ? `still present: ${gone.id}` : "removed");
                    // Only forget the id if the row is actually gone. Dropping it
                    // from the cleanup set unconditionally is how a failed delete
                    // turns into a permanently leaked row — the run reported
                    // "201 -> 202" and left its own record behind.
                    if (gone === null) createdRecordIds.delete(made.id);
                  }
                }
              }
            }
          }
        } else {
          note(`no Save button in the record dialog; dialog said: ${(await dialog.innerText().catch(() => "")).slice(0, 160)}`);
        }
      } else {
        note("the Add attendance record dialog did not open");
      }
    }
  }

  // The finalized-record guard is NOT tested by deleting a row through the
  // service role. That bypasses RLS entirely, so it would prove nothing about the
  // action's guard while risking a real demo row — and a restore would have to
  // reconstruct the original employee_id and work_date to be faithful. An earlier
  // draft of this script did exactly that and would have left the wrong data
  // behind. Proving a guard must not require destroying what it guards.
  note("finalized-record guard: exercised only through the UI, never by deleting live rows");

  await empCtx.close().catch(() => {});
  await hrManualCtx.close().catch(() => {});

  check("no uncaught page errors during the attendance run", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
  if (consoleErrors.length) note(`${consoleErrors.length} console error(s) (informational): ${consoleErrors.slice(0, 2).join(" | ").slice(0, 160)}`);
} catch (e) {
  console.error(`\nRUN ERROR: ${e.message}`);
  console.error(e.stack?.split("\n").slice(1, 4).join("\n"));
  process.exitCode = 1;
} finally {
  // ---- cleanup: remove only what this run created, then read the rows back ----
  for (const id of createdCorrectionIds) {
    await db.from("attendance_correction_requests").delete().eq("id", id);
  }
  // Everything the run added to approval_requests, found by difference.
  const newApprovals = (await must(db.from("approval_requests").select("id").limit(2000), "approvals after"))
    .map((r) => r.id)
    .filter((id) => !approvalIdsBefore.has(id));
  for (const id of newApprovals) {
    await db.from("approval_actions").delete().eq("request_id", id);
    await db.from("approval_requests").delete().eq("id", id);
  }
  if (newApprovals.length) console.log(`  (cleanup) removed ${newApprovals.length} approval request(s) this run created`);
  for (const id of createdRecordIds) {
    await db.from("attendance_records").delete().eq("id", id);
  }
  await browser.close().catch(() => {});

  const after = {
    records: (await db.from("attendance_records").select("id", { count: "exact", head: true })).count,
    corrections: (await db.from("attendance_correction_requests").select("id", { count: "exact", head: true })).count,
    approvals: (await db.from("approval_requests").select("id", { count: "exact", head: true })).count,
  };
  const approvalsBeforeCount = approvalIdsBefore.size;
  console.log("");
  check("no attendance records leaked", after.records === before.records,
    `${before.records} -> ${after.records}`);
  check("no correction requests leaked", after.corrections === before.corrections,
    `${before.corrections} -> ${after.corrections}`);
  check("no approval requests leaked", after.approvals === approvalsBeforeCount,
    `${approvalsBeforeCount} -> ${after.approvals}`);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("\nFAILURES:");
    for (const f of failed) console.log(`  - ${f.name}`);
    process.exitCode = 1;
  }

  // Evidence, not a claim -- written by the exercise itself, not only by the
  // orchestrator. `qa-run-workflows.mjs` reaches ~20 exercises and the app server
  // reaches ~2.4 GB under that much browser load; a run killed part-way leaves the
  // orchestrator unable to refresh anything. That is not hypothetical here: after
  // this exercise passed 31/31 on its own, `docs/evidence/workflow-attendance.json`
  // still read FAIL from an earlier run, because nothing but the orchestrator wrote
  // it. A stale red record for a defect that is already fixed is the exact failure
  // the evidence rule exists to prevent. `qa-exercise-admin-workflow.mjs` was given
  // the same treatment for the same reason.
  try {
    mkdirSync("docs/evidence", { recursive: true });
    writeFileSync(
      "docs/evidence/workflow-attendance.json",
      JSON.stringify(
        {
          id: "attendance",
          script: "scripts/audit/qa-exercise-attendance-workflow.mjs",
          claim:
            "an employee clocks in and out from /app/my/attendance, HR enters a record manually, " +
            "and nothing is left behind",
          base: BASE,
          when: new Date().toISOString(),
          timezone: EMPLOYEE_TZ,
          todayUsed: TODAY,
          exitCode: process.exitCode ?? 0,
          verdict: failed.length ? "fail" : "pass",
          assertions: results.length,
          failedAssertions: failed,
          notes,
          results,
        },
        null,
        2,
      ) + "\n",
    );
    console.log("wrote docs/evidence/workflow-attendance.json");
  } catch (err) {
    console.error(
      "could not write evidence:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Monday of the week containing `date`, as yyyy-MM-dd, for the ?week= filter. */
function weekOf(date) {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}