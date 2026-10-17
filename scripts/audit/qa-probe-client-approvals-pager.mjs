// Prove /app/client/approvals paginates, instead of asserting that it does.
//
// THE DEFECT
// This page carried `.limit(40)` with no pager and no indication. A client with 41+ days
// waiting saw exactly 40 and had no way to know more existed -- on the one screen whose
// entire job is telling someone what is waiting for them. Its sibling
// `/app/client/timesheets` was fixed for precisely this in an earlier session and this page
// was missed. A sweep of every `.limit(` in `app/app/**` confirms it was the last silent cap
// on a decision queue; the rest are documented sub-queries or detail pages.
//
// WHAT THIS DOES
// Seeds 25 days in `client_review` for one client org's assigned employee -- inside the
// assignment window, because the guard added in commit 15a5193 would refuse an out-of-window
// day, and a fixture the product rejects is not a fixture. Then, as the client:
//
//   1. page 1 shows exactly PAGE_SIZE rows and a pager
//   2. page 2 shows the remaining 5
//   3. the two pages together account for all 25
//   4. under the OLD code page 1 would have shown 40, so 25 cannot distinguish it --
//      therefore the count is asserted from the DOM and the pager must exist to be clicked
//
// Every seeded row is deleted in `finally`, by id, after being read back.
//
// Usage: node scripts/audit/qa-probe-client-approvals-pager.mjs

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
const TOTAL = 25; // deliberately between PAGE_SIZE (20) and the old cap of 40

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  - ${detail}` : ""}`);
}
const note = (m) => console.log(`NOTE  ${m}`);

async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}

// Pool dates across EVERY active client assignment for one client org, not just one
// employee: the first version asked a single employee for 25 days and only 17 were free
// inside the window, which is below PAGE_SIZE and so cannot demonstrate pagination at all.
// Both employees belong to the same org, giving 33 -- enough to prove a second page.
const allAssignments = await must(
  db.from("employee_assignments")
    .select("employee_id, client_organization_id, start_date, end_date, status")
    .eq("assignment_type", "client")
    .eq("status", "active")
    .not("client_organization_id", "is", null)
    .not("start_date", "is", null),
  "assignments",
);
if (!allAssignments.length) throw new Error("no active client assignments; cannot build the fixture");

const orgId = allAssignments[0].client_organization_id;
const assignments = allAssignments.filter((a) => a.client_organization_id === orgId);
const employeeIds = assignments.map((a) => a.employee_id);

const { data: existing } = await db.from("attendance_records")
  .select("employee_id, work_date")
  .in("employee_id", employeeIds);
const takenByEmployee = new Map(employeeIds.map((id) => [id, new Set()]));
for (const r of existing ?? []) takenByEmployee.get(r.employee_id)?.add(r.work_date);

const today = new Date().toISOString().slice(0, 10);

/** Build the fixture plan: {employee_id, work_date}[], inside the window, never duplicated. */
const plan = [];
for (const a of assignments) {
  const taken = takenByEmployee.get(a.employee_id);
  const startMs = new Date(`${a.start_date}T00:00:00Z`).getTime();
  const endMs = a.end_date
    ? new Date(`${a.end_date}T00:00:00Z`).getTime()
    : new Date(`${today}T00:00:00Z`).getTime();
  for (let ms = endMs; ms >= startMs && plan.length < TOTAL; ms -= 86400000) {
    const d = new Date(ms).toISOString().slice(0, 10);
    if (d <= today && !taken.has(d)) {
      taken.add(d); // in-memory guard: this run must not collide with its own earlier insert
      plan.push({ employee_id: a.employee_id, work_date: d });
    }
  }
}
if (plan.length < 21) {
  throw new Error(`only ${plan.length} free in-window dates across this org; need at least 21 to prove a second page`);
}
note(`org ${orgId.slice(0, 8)}  employees=${assignments.length}  fixture plan=${plan.length} days`);
note(`window ${assignments[0].start_date} .. ${assignments[0].end_date ?? "open"}`);

const created = [];
let browser;
try {
  for (const { employee_id, work_date } of plan) {
    const row = (await must(
      db.from("attendance_records").insert({
        employee_id,
        work_date,
        status: "present",
        worked_minutes: 480,
        break_minutes: 60,
        late_minutes: 0,
        overtime_minutes: 0,
        undertime_minutes: 0,
        approval_status: "client_review",
        shift_assignment_id: null,
        clock_in_at: `${work_date}T09:00:00.000Z`,
        clock_out_at: `${work_date}T18:00:00.000Z`,
      }).select("id").limit(1),
      `seed ${work_date}`,
    ))[0];
    created.push(row.id);
  }
  note(`seeded ${created.length} rows`);

  // Confirm the view the page reads actually returns them.
  const visible = await must(
    db.from("client_attendance_summary").select("attendance_record_id")
      .in("attendance_record_id", created),
    "client view",
  );
  if (visible.length < plan.length) throw new Error(`only ${visible.length}/${plan.length} fixtures reach the client view; fixture invalid`);

  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("input[type=email]").first().waitFor({ state: "visible", timeout: 20000 });
  await fillHeld(page, page.locator("input[type=email]").first(), "clientadmin@demo.beepabpo.com");
  await fillHeld(page, page.locator("input[type=password]").first(), env.DEMO_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/app/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  if (page.url().includes("/login")) throw new Error("clientadmin could not sign in");

  async function readPage(query) {
    await page.goto(`${BASE}/app/client/approvals${query}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    // The pager renders as a link to page 2; its absence is the regression signal.
    // ListPager renders ONLY "Previous"/"Next" links -- never numbered page links. An earlier
    // version looked for a link whose text is "2" and reported the pager missing on a build
    // that had it, which would have been a false defect. Locate by what the component
    // actually renders.
    const pager = page.locator("a").filter({ hasText: /^\s*Next\s*$/i });
    const bodyText = await page.locator("body").innerText();
    if (process.env.QA_DEBUG) {
      note(`--- ${query || "(page 1)"} body, chars 600-2000 ---`);
      note(bodyText.slice(600, 2000).replace(/\n{2,}/g, "\n"));
    }
    // The date renders as "Oct 2, 2026" -- the third rendering this repo has used for a
    // date column. Match all three so a formatting change cannot silently produce
    // "0 rows found" and be misreported as a pagination failure.
    //
    // Count ROWS, not distinct dates: the fixture spans two employees, so the same
    // work_date legitimately appears twice on the page.
    const rows = (bodyText.match(/Timesheet . /g) ?? []).length;
    const iso = [...bodyText.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map((m) => m[0]);
    const pretty = [...bodyText.matchAll(/\b[A-Z][a-z]{2} \d{1,2}, \d{4}\b/g)].map((m) => m[0]);
    return { pagerCount: await pager.count(), rows, dates: [...new Set([...iso, ...pretty])], bodyText };
  }

  const p1 = await readPage("");
  check("page 1 is capped at PAGE_SIZE, not at the old 40", p1.rows > 0 && p1.rows <= 20,
    `${p1.rows} row(s) rendered`);
  check("a pager is offered, which the silent .limit(40) never had", p1.pagerCount > 0,
    `${p1.pagerCount} link(s) to page 2`);

  const p2 = await readPage("?page=2");
  check("page 2 renders the remainder", p2.rows > 0 && p2.rows <= 20,
    `${p2.rows} row(s) rendered`);

  // The decisive assertion. Under the OLD code all 25 render on one page and there is no
  // page 2 at all, so "page 1 holds exactly PAGE_SIZE AND page 2 holds the other 5" cannot
  // be produced by the old behaviour -- it is the fix, observed.
  check(`all ${TOTAL} pending items are reachable across the two pages`,
    p1.rows + p2.rows === TOTAL,
    `page1=${p1.rows} page2=${p2.rows} sum=${p1.rows + p2.rows}`);
  check("the split is caused by pagination, not by missing rows", p1.rows === 20,
    `page1=${p1.rows} (PAGE_SIZE is 20)`);
} catch (e) {
  console.error(`\nRUN ERROR: ${e.message}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (created.length) {
    const { error } = await db.from("attendance_records").delete().in("id", created);
    note(`cleanup: ${error ? `FAILED ${error.message}` : `${created.length} fixture row(s) deleted`}`);
  }
  const { count } = await db.from("attendance_records")
    .select("id", { count: "exact", head: true })
    .in("employee_id", employeeIds);
  note(`attendance records for this employee now: ${count}`);
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} assertions passed`);
process.exitCode = process.exitCode || (passed === results.length ? 0 : 1);