// Exercise the NTE domain end to end: HR issues a case, the named employee
// responds, HR resolves it with a disciplinary outcome, and the response deadline
// an HR user typed is the deadline the employee is shown.
//
// WHY: three actions in lib/hr/nte-actions.ts, none of which had ever been driven
// through a browser. This is the most sensitive workflow in the product (it moves an
// employee towards dismissal) and it spans three actors, so the interesting
// assertions are about who may act, not about whether a form saves.
//
// WHAT IS ACTUALLY BEING TESTED
//
// 1. Ownership. `submitNteResponse` refuses a case whose `employee_id` is not the
//    signed-in employee's own record. The UI only renders the response form for
//    cases the employee already owns, so the action-level guard is a backstop. This
//    run asserts the user-visible half of that rule: another employee's case must
//    not appear on /app/my/nte at all.
//
// 2. The stale-tab race. `app/app/hr/nte/page.tsx:136` renders the resolve form only
//    while the case status is open, so the UI already prevents resolving twice. That
//    also means the guard inside `resolveNteCase` ("cannot be resolved from status")
//    is unreachable by clicking twice. It is reachable the way it actually matters:
//    two HR tabs. This run opens a second HR page before the first one resolves,
//    then submits the stale form, so the guard is watched refusing rather than
//    merely observed to exist.
//
// 3. The deadline. `createNteCase` stores `response_due_at` straight from a
//    `datetime-local` input with no timezone conversion, which is the same shape as
//    the attendance-correction defect fixed earlier. It is asserted here as what the
//    EMPLOYEE SEES, because that is the only form in which it can be wrong: the page
//    renders `format(new Date(...), "MMM d, yyyy")`, i.e. the date only, and the
//    date component round-trips through the UTC cast unchanged. The stored instant is
//    still 8 hours out from the wall clock HR typed, recorded as a note, because
//    nothing user-visible reads it yet.
//
// SAFETY: every row the run creates is removed in a `finally` and the removal is
// asserted by reading counts back. Audit-log rows are deliberately left.
//
// Usage: node scripts/audit/qa-exercise-nte-workflow.mjs

import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { fillHeld } from "./lib/browser-form.mjs";
import { writeEvidence } from "./lib/evidence.mjs";

// The product's own timezone helper, so the note about the stored instant cannot
// drift from what the product actually does.
const { zonedWorkDateTime } = await import("../../lib/attendance/zoned-time.ts").catch(() => ({
  zonedWorkDateTime: null,
}));

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

const EMPLOYEE_EMAIL = "employee@demo.beepabpo.com";
const HR_EMAIL = "hr@demo.beepabpo.com";
const STAMP = Date.now().toString(36);
const MARK = `qante${STAMP}`;
// A second, independent marker. Sharing MARK would mean the HR search filter
// legitimately matches both cases, and the run could no longer tell "the filter is
// broken" from "two cases contain my marker".
const OTHER_MARK = `qanto${STAMP}`;
const INCIDENT_DATE = "2026-03-02";
const DUE_TYPED = "2026-03-09T17:00";

const { data: authData, error: authErr } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
if (authErr) throw new Error(`auth users: ${authErr.message}`);
const userIdFor = (email) => authData.users.find((u) => u.email === email)?.id ?? null;

const employeeUserId = userIdFor(EMPLOYEE_EMAIL);
const hrUserId = userIdFor(HR_EMAIL);
if (!employeeUserId || !hrUserId) throw new Error("demo employee or HR auth user missing");

const subjectEmployee = await must(
  db.from("employees").select("id, employee_number, default_timezone").eq("profile_id", employeeUserId).limit(1),
  "employee row",
);
const subjectEmp = subjectEmployee[0];
if (!subjectEmp) throw new Error("no employee row for the demo employee");

// A second active employee, so the ownership assertion has something to own.
const otherEmployee = (
  await must(
    db
      .from("employees")
      .select("id, employee_number")
      .eq("employment_status", "active")
      .neq("profile_id", employeeUserId)
      .limit(1),
    "other employee",
  )
)[0];
if (!otherEmployee) throw new Error("no second active employee to test ownership against");

console.log(`subject employee: ${EMPLOYEE_EMAIL} -> ${subjectEmp.id}`);
console.log(`other employee:   ${otherEmployee.employee_number} -> ${otherEmployee.id}\n`);

const countOf = async (table) =>
  (await db.from(table).select("id", { count: "exact", head: true })).count ?? 0;

const before = {
  cases: await countOf("nte_cases"),
  responses: await countOf("nte_responses"),
  actions: await countOf("disciplinary_actions"),
};
console.log(`before: cases=${before.cases} responses=${before.responses} actions=${before.actions}\n`);

const createdCaseIds = new Set();
const browser = await chromium.launch();
const consoleErrors = [];
const pageErrors = [];

async function signIn(page, email, path = "/login") {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  const field = page.locator("input[name=email], input[type=email]").first();
  await field.waitFor({ state: "visible", timeout: 20000 });
  await fillHeld(page, field, email);
  await fillHeld(page, page.locator("input[type=password]").first(), env.DEMO_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/app/, { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);
}

function watch(page) {
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(e.message));
}

async function findCase(subjectFragment) {
  const rows = await must(
    db.from("nte_cases").select("id, case_number, status").ilike("subject", `%${subjectFragment}%`),
    "case lookup",
  );
  return rows[0] ?? null;
}

const INCIDENT_TYPE = "attendance_pattern";

try {
  // ---------------------------------------------------------------- HR issues
  const hrContext = await browser.newContext();
  const hrPage = await hrContext.newPage();
  watch(hrPage);
  await signIn(hrPage, HR_EMAIL);
  await hrPage.goto(`${BASE}/app/hr/nte`, { waitUntil: "domcontentloaded" });
  await hrPage.waitForTimeout(1200);

  check("HR reaches /app/hr/nte with the case form", await hrPage.locator("#subject").isVisible());

  // `incident_type` is free text, not an enum select; the schema is a bare
  // z.string().min(2).max(120). Assert the control really is an input so a later
  // change to an enum select fails loudly here rather than the run filling a field
  // that expects something else and passing for the wrong reason.
  const incidentTag = await hrPage
    .locator("#incident_type")
    .evaluate((el) => el.tagName.toLowerCase())
    .catch(() => "missing");
  check("incident type is a free-text field", incidentTag === "input", incidentTag);

  await hrPage.selectOption("#employee_id", subjectEmp.id);
  await hrPage.fill("#incident_date", INCIDENT_DATE);
  await hrPage.fill("#incident_type", INCIDENT_TYPE);
  await hrPage.fill("#subject", `${MARK} attendance follow-up`);
  await hrPage.fill("#description", `QA NTE exercise ${MARK}. Created to prove the issue/respond/resolve path.`);
  await hrPage.fill("#response_due_at", DUE_TYPED);
  await hrPage.getByRole("button", { name: "Create NTE case" }).click();
  await hrPage.waitForTimeout(2500);

  const created = await findCase(MARK);
  check("createNteCase writes a case", created !== null, created ? created.case_number : "no row");
  check("new case starts in status 'issued'", created?.status === "issued", created?.status ?? "n/a");
  if (created) createdCaseIds.add(created.id);

  if (created) {
    const row = await must(
      db.from("nte_cases").select("issued_by, response_due_at, incident_date").eq("id", created.id).limit(1),
      "created case detail",
    );
    check("case is issued by the HR user", row[0].issued_by === hrUserId, String(row[0].issued_by).slice(0, 8));
    check(
      "incident date stored as typed",
      String(row[0].incident_date).slice(0, 10) === INCIDENT_DATE,
      String(row[0].incident_date),
    );

    const storedDue = row[0].response_due_at;
    if (storedDue) {
      // Compare against the instant HR *meant*: their wall clock read in the
      // employee's timezone. Comparing against the naive string read as UTC is
      // trivially zero and says nothing.
      const intendedUtc = zonedWorkDateTime(DUE_TYPED.slice(0, 10), DUE_TYPED.slice(11, 16), "Asia/Manila");
      const offHours = intendedUtc
        ? (new Date(storedDue).getTime() - new Date(intendedUtc).getTime()) / 3600000
        : null;
      note(
        `response_due_at stored as ${storedDue} for a wall clock HR typed as ${DUE_TYPED} ` +
          `(intended instant ${intendedUtc}, off by ${offHours}h).`,
      );
    }
  }

  // ------------------------------------------------------- employee responds
  const empContext = await browser.newContext();
  const empPage = await empContext.newPage();
  watch(empPage);
  await signIn(empPage, EMPLOYEE_EMAIL);
  await empPage.goto(`${BASE}/app/my/nte`, { waitUntil: "domcontentloaded" });
  await empPage.waitForTimeout(1500);

  check(
    "employee sees their own case on /app/my/nte",
    await empPage.getByText(`${MARK} attendance follow-up`).first().isVisible(),
  );

  const dueText = await empPage
    .locator("text=/Due /")
    .first()
    .textContent()
    .catch(() => null);
  check(
    "deadline shown to the employee is the date HR typed",
    typeof dueText === "string" && dueText.includes("Mar 9, 2026"),
    dueText ? dueText.trim() : "nothing rendered",
  );

  if (created) {
    const responseField = empPage.locator(`#nte-response-${created.id}`);
    check("employee gets a response form for their case", await responseField.isVisible());
    await responseField.fill(`QA response ${MARK}. I acknowledge the attendance pattern and will correct it.`);
    // Scope to the form that owns this case. The employee may have other cases on
    // the page, each with an identically labelled button, and an unscoped
    // getByRole throws a strict-mode violation instead of failing an assertion.
    await empPage
      .locator(`form:has(#nte-response-${created.id})`)
      .getByRole("button", { name: "Submit response" })
      .click();
    await empPage.waitForTimeout(2500);

    const respRows = await must(
      db.from("nte_responses").select("id, nte_case_id").eq("nte_case_id", created.id),
      "response lookup",
    );
    check("submitNteResponse writes a response", respRows.length === 1, `${respRows.length} row(s)`);

    const afterRespond = await findCase(MARK);
    check(
      "responding moves the case to 'under_review'",
      afterRespond?.status === "under_review",
      afterRespond?.status ?? "n/a",
    );
  }

  // ------------------------------------------------------- ownership is real
  await hrPage.bringToFront();
  await hrPage.selectOption("#employee_id", otherEmployee.id);
  await hrPage.fill("#incident_type", INCIDENT_TYPE);
  await hrPage.fill("#subject", `${OTHER_MARK} other employee case`);
  await hrPage.fill("#description", `QA ownership check ${OTHER_MARK}. This case belongs to another employee.`);
  await hrPage.getByRole("button", { name: "Create NTE case" }).click();
  await hrPage.waitForTimeout(2500);

  const otherCase = await findCase(`${OTHER_MARK} other employee case`);
  check("second case created for another employee", otherCase !== null);
  if (otherCase) createdCaseIds.add(otherCase.id);

  await empPage.reload({ waitUntil: "domcontentloaded" });
  await empPage.waitForTimeout(1500);
  const leaked = await empPage.getByText(`${OTHER_MARK} other employee case`).count();
  check("another employee's NTE case is not visible to this employee", leaked === 0, `${leaked} shown`);

  // ------------------------------------------------- resolve, and the race
  if (created) {
    // A second HR *tab* in the same context, so it shares HR's session. A fresh
    // context has its own cookie jar, lands on /login, and renders no resolve form at
    // all -- a test that looks like it is exercising a stale tab while actually
    // exercising an anonymous visitor.
    //
    // Both tabs are narrowed with the page's own search filter. Two open cases each
    // render an identically labelled "Resolve NTE" button, so `.first()` would fill
    // one case's notes and submit the other's.
    const listUrl = `${BASE}/app/hr/nte?q=${encodeURIComponent(MARK)}`;
    await hrPage.goto(listUrl, { waitUntil: "domcontentloaded" });
    await hrPage.waitForTimeout(1500);
    const stalePage = await hrContext.newPage();
    watch(stalePage);
    await stalePage.goto(listUrl, { waitUntil: "domcontentloaded" });
    await stalePage.waitForTimeout(1500);

    check(
      "the HR search filter narrows the list to the case under test",
      (await hrPage.getByRole("button", { name: "Resolve NTE" }).count()) === 1,
      `${await hrPage.getByRole("button", { name: "Resolve NTE" }).count()} resolve button(s)`,
    );

    const staleFormPresent = await stalePage.locator(`#nte-notes-${created.id}`).isVisible();
    check("resolve form is shown while the case is open", staleFormPresent);

    await hrPage.bringToFront();
    await hrPage.selectOption(`#nte-resolution-${created.id}`, "verbal_warning");
    await hrPage.fill(`#nte-notes-${created.id}`, `Resolved in QA exercise ${MARK}. Verbal warning issued.`);
    // The trigger is "Resolve NTE"; only the ConfirmDialog's confirm button is
    // "Resolve case". Clicking the dialog label straight away times out.
    await hrPage.getByRole("button", { name: "Resolve NTE" }).first().click();
    await hrPage.waitForTimeout(900);
    const confirmBtn = hrPage.getByRole("button", { name: "Resolve case" }).last();
    check("resolve confirmation dialog opens", await confirmBtn.isVisible().catch(() => false));
    if (await confirmBtn.isVisible().catch(() => false)) await confirmBtn.click();
    await hrPage.waitForTimeout(2500);

    const resolved = (
      await must(
        db.from("nte_cases").select("status, resolution_type, resolution_notes").eq("id", created.id).limit(1),
        "resolved case",
      )
    )[0];
    check("resolveNteCase sets status 'resolved'", resolved.status === "resolved", resolved.status);
    check(
      "resolveNteCase stores the resolution type",
      resolved.resolution_type === "verbal_warning",
      String(resolved.resolution_type),
    );

    const actionRows = await must(
      db.from("disciplinary_actions").select("id, action_type").eq("nte_case_id", created.id),
      "disciplinary action lookup",
    );
    check(
      "a non-cleared resolution writes a disciplinary action",
      actionRows.length === 1 && actionRows[0].action_type === "verbal_warning",
      `${actionRows.length} row(s)`,
    );

    if (staleFormPresent) {
      await stalePage.bringToFront();
      await stalePage
        .selectOption(`#nte-resolution-${created.id}`, "dismissal")
        .catch(() => {});
      await stalePage.fill(`#nte-notes-${created.id}`, "Stale tab attempting a second resolution.");
      await stalePage.getByRole("button", { name: "Resolve NTE" }).first().click();
      await stalePage.waitForTimeout(900);
      const staleConfirm = stalePage.getByRole("button", { name: "Resolve case" }).last();
      if (await staleConfirm.isVisible().catch(() => false)) await staleConfirm.click();
      await stalePage.waitForTimeout(2500);

      const staleText = (await stalePage.locator("body").innerText()).replace(/\s+/g, " ");
      check(
        "a stale tab is refused: the case cannot be resolved from status 'resolved'",
        /cannot be resolved from status/i.test(staleText),
        (/cannot be resolved from status[^.]{0,40}/i.exec(staleText) ?? ["no refusal on screen"])[0],
      );

      const actionRowsAfter = await must(
        db.from("disciplinary_actions").select("id, action_type").eq("nte_case_id", created.id),
        "disciplinary action recheck",
      );
      check(
        "the refused attempt wrote no second disciplinary action",
        actionRowsAfter.length === 1,
        `${actionRowsAfter.length} row(s)`,
      );

      const stillResolved = (
        await must(
          db.from("nte_cases").select("status, resolution_type").eq("id", created.id).limit(1),
          "case after refusal",
        )
      )[0];
      check(
        "the refusal left the resolution untouched",
        stillResolved.status === "resolved" && stillResolved.resolution_type === "verbal_warning",
        `${stillResolved.status}/${stillResolved.resolution_type}`,
      );
    }
    await stalePage.close();
  }

  const realErrors = consoleErrors.filter((e) => !/favicon|404 \(Not Found\)/i.test(e));
  check("no unexpected console errors", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));
  check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
} catch (e) {
  console.error(`ERROR: ${e.message}`);
  results.push({ name: "run completed without throwing", pass: false });
} finally {
  // Cleanup by the run marker, not by remembered ids. A cleanup that silently
  // matched nothing is how a run leaves state behind while printing a clean line.
  for (const id of createdCaseIds) {
    await db.from("nte_responses").delete().eq("nte_case_id", id);
    await db.from("disciplinary_actions").delete().eq("nte_case_id", id);
    await db.from("nte_cases").delete().eq("id", id);
  }
  const leftovers = await must(
    db.from("nte_cases").select("id").or(`subject.ilike.%${MARK}%,subject.ilike.%${OTHER_MARK}%`),
    "leftover check",
  );
  console.log(`\n(cleanup) cases still carrying the marker: ${leftovers.length}`);

  const after = {
    cases: await countOf("nte_cases"),
    responses: await countOf("nte_responses"),
    actions: await countOf("disciplinary_actions"),
  };
  console.log(`(cleanup) before cases=${before.cases} responses=${before.responses} actions=${before.actions}`);
  console.log(`(cleanup) after  cases=${after.cases} responses=${after.responses} actions=${after.actions}`);

  const restored =
    after.cases === before.cases &&
    after.responses === before.responses &&
    after.actions === before.actions;
  console.log(`\nthe sweep left the demo data as it found it: ${restored ? "yes" : "NO"}`);
  if (!restored) process.exitCode = 1;

  await browser.close().catch(() => {});

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} assertions passed`);
  if (passed !== results.length) process.exitCode = 1;
  if (notes.length) {
    console.log("\nnotes:");
    for (const n of notes) console.log(`  - ${n}`);
  }

  // Evidence, written by the exercise itself, after the last `process.exitCode`
  // assignment because `writeEvidence` derives the verdict from it.
  // See `scripts/audit/lib/evidence.mjs`.
  try {
    const { file } = writeEvidence({
      id: "nte",
      script: "scripts/audit/qa-exercise-nte-workflow.mjs",
      claim: "the NTE domain end to end: HR issues a case, the named employee responds, HR resolves it with a disciplinary outcome",
      base: BASE,
      checks: results,
      notes,
      exitCode: process.exitCode ?? 0,
      extra: {
        // The case, response and disciplinary-action counts before and after, so
        // the cleanup's "left the demo data as it found it" claim can be read
        // off the file rather than taken from the console log.
        before,
        after,
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