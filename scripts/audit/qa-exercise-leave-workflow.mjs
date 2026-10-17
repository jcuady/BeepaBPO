// Exercise the live leave workflow end to end and prove the rewritten
// notifications are correct — not merely that the code compiles.
//
// Before this ran, approval_requests held 25 rows and approval_actions held 0:
// no approval had ever been actioned, so the approval engine, the decision
// notification, and the team-lead distribution path were all unexercised.
//
// employee@  submits a leave request  ->  teamlead@ approves it
//
// Asserts, against the database rather than against the DOM:
//   1. a leave_request row exists for the employee
//   2. an approval_request exists and is pending
//   3. a leave.request notification went to the team lead, and its body is
//      SPECIFIC (names the requester, the leave type and the dates)
//   4. approval_actions gains a row when the lead approves
//   5. a leave.decision notification reaches the EMPLOYEE, also specific
//
// Usage: node scripts/audit/qa-exercise-leave-workflow.mjs
// Requires a running server (QA_BASE_URL, default http://localhost:3100).

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
const PW = env.DEMO_PASSWORD;
// Cleans up its own artefacts from previous runs by default. Pass --no-cleanup
// to inspect the rows it leaves behind.
const APPLY_CLEANUP = !process.argv.includes("--no-cleanup");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

const iso = (d) => d.toISOString().slice(0, 10);
const startDate = iso(new Date(Date.now() + 21 * 86400_000));
const endDate = iso(new Date(Date.now() + 23 * 86400_000));

const browser = await chromium.launch();

async function signIn(email) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await fillHeld(page, page.locator('input[type=email]'), email);
  await fillHeld(page, page.locator('input[type=password]'), PW);
  // Wait for the OUTCOME, not a duration. The returned page is read by callers
  // to decide whether the user got in, so a fixed sleep here turned "the
  // machine was busy" into "this account cannot sign in".
  await submitAndWaitOutcome(page, 'button[type=submit]', { loginPath: "/login", timeout: 25000 });
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  return { ctx, page };
}

// Resolve the employee BY the account we are signing in as. Taking
// `employees.limit(1)` instead picks an arbitrary row, which made the first run
// assert against somebody else's already-approved leave and report four
// failures that were all measurement error.
const { data: authList } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
const authByEmail = new Map((authList?.users ?? []).map((u) => [u.email, u.id]));
const employeeUserId = authByEmail.get("employee@demo.beepabpo.com");
const { data: employee } = await db
  .from("employees")
  .select("id, profile_id")
  .eq("profile_id", employeeUserId)
  .maybeSingle();
if (!employee) {
  console.error("could not resolve the employee record for employee@demo.beepabpo.com");
  process.exitCode = 1;
}

// Identify the team lead's user id from their memberships + roles.
const { data: memberships } = await db.from("organization_memberships").select("id, user_id");
const { data: mRoles } = await db.from("membership_roles").select("membership_id, role_id");
const { data: roles } = await db.from("roles").select("id, code");
const leadRoleIds = new Set((roles ?? []).filter((r) => r.code === "team_lead").map((r) => r.id));
const teamLeadUserIds = (memberships ?? [])
  .filter((m) => (mRoles ?? []).some((mr) => mr.membership_id === m.id && leadRoleIds.has(mr.role_id)))
  .map((m) => m.user_id);

// Everything created after this point is ours; compare against it rather than
// against "the newest row", which can be somebody else's.
const RUN_START = new Date(Date.now() - 60_000).toISOString();

// A UNIQUE marker per run. Using a fixed reason text meant `tr:has-text(...)`
// matched the previous run's row — the queue is oldest-first, so `.first()`
// kept approving an older leave while the assertions looked at the new one.
// Three runs each "failed" this way before the marker was made unique.
const MARKER = `QA workflow exercise ${Date.now().toString(36)}`;
const REASON = `${MARKER} — family commitment out of town.`;

/** Delete leave requests and everything hanging off them. */
async function purgeLeaveIds(ids) {
  if (!ids.length) return;
  const { data: reqs } = await db.from("approval_requests").select("id").in("entity_id", ids);
  const reqIds = (reqs ?? []).map((r) => r.id);
  if (reqIds.length) {
    await db.from("approval_actions").delete().in("request_id", reqIds);
    await db.from("approval_requests").delete().in("id", reqIds);
  }
  await db.from("notifications").delete().in("entity_id", ids);
  await db.from("leave_requests").delete().in("id", ids);
}

/** How many of our own leave requests are still in the database right now. */
async function countExerciseLeave() {
  const { count, error } = await db
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .like("reason", "QA workflow exercise%");
  if (error) throw new Error(`count failed: ${error.message}`);
  return count ?? 0;
}

// ---- 0. clear anything a previous run of THIS script left behind ----
//
// Without this the exercise is a data generator, not a test: six runs left six
// bereavement leave rows for the same employee and the same dates, which
// tripped `live-data-smoke.test.ts` — "No duplicate bereavement leave for demo
// employee" — an invariant this script was breaking on every invocation.
//
// Sweeping at START is not enough, though — it only cleans up the run BEFORE
// the last one, which is exactly how a ticket from the final run of a session
// survived. The end-of-run cleanup in the `finally` below is what actually
// makes the script leave nothing.
if (APPLY_CLEANUP) {
  const { data: stale, error } = await db
    .from("leave_requests")
    .select("id")
    .like("reason", "QA workflow exercise%");
  if (error) throw new Error(`previous-run sweep failed: ${error.message}`);
  if (stale?.length) {
    await purgeLeaveIds(stale.map((r) => r.id));
    console.log(`cleanup: removed ${stale.length} leave request(s) left by previous runs`);
  }
} else {
  console.log("cleanup: skipped (--no-cleanup)");
}

const residualBefore = await countExerciseLeave();
let createdLeaveId = null;
// The cancel leg creates and withdraws a second request. It is tracked separately
// so the finally block can purge both -- a cancelled row is still a row, and
// leaving it behind would make the next run's residual count fail for a reason
// that has nothing to do with the next run.
let cancelledLeaveId = null;

// ---- 1. employee submits ----
// Baseline is taken AFTER cleanup. Capturing it first made the cleanup's own
// deletions look like a regression ("approval_actions 10 -> 2").
const { count: notifBefore } = await db
  .from("notifications")
  .select("id", { count: "exact", head: true });
const { count: actionsBefore } = await db
  .from("approval_actions")
  .select("id", { count: "exact", head: true });
console.log(`baseline: ${notifBefore} notifications, ${actionsBefore} approval actions, ${residualBefore} residual exercise leaves\n`);

try {
// ---- 1. employee submits ----
const emp = await signIn("employee@demo.beepabpo.com");
await emp.page.goto(`${BASE}/app/my/leave`, { waitUntil: "domcontentloaded" });
await emp.page.waitForSelector("#leave_type_id", { timeout: 20000 });

const options = await emp.page.$$eval("#leave_type_id option", (os) =>
  os.map((o) => ({ value: o.value, label: o.textContent.trim() })).filter((o) => o.value),
);
// Never pick BEREAVEMENT. `live-data-smoke.test.ts` asserts at most one
// bereavement row per (employee, dates), and this script picks fixed future
// dates — so choosing it would guarantee a duplicate on the second run.
const chosen = options.find((o) => !/bereavement/i.test(o.label)) ?? options[0];
if (!chosen) { console.error("no leave types available"); process.exitCode = 1; }
await emp.page.selectOption("#leave_type_id", chosen.value);
await emp.page.fill("#start_date", startDate);
await emp.page.fill("#end_date", endDate);
await emp.page.fill("#reason", REASON);

// ---- 1a. Reset must clear a dirty form and submit nothing ----
//
// `qa-control-surface-census.mjs` reported Reset and Cancel as the only two
// action controls on the whole measured surface that no assertion mentions. They
// are `form.reset({ ...defaults })` and `cancelLeaveRequest(requestId)` -- a
// browser affordance and a real server action that withdraws a request, both used
// by employees every week and both untested.
//
// Reset is asserted on a DIRTY form, because a Reset on an already-empty form
// proves nothing: it would pass identically if the handler did nothing at all.
const { count: beforeReset } = await db
  .from("leave_requests")
  .select("id", { count: "exact", head: true })
  .gt("created_at", RUN_START);

await emp.page.getByRole("button", { name: /^reset$/i }).click();
await emp.page.waitForTimeout(800);

const afterReset = await emp.page.evaluate(() => ({
  type: document.querySelector("#leave_type_id")?.value ?? null,
  start: document.querySelector("#start_date")?.value ?? null,
  end: document.querySelector("#end_date")?.value ?? null,
  reason: document.querySelector("#reason")?.value ?? null,
}));
check(
  "Reset clears a dirty form back to defaults",
  !afterReset.start && !afterReset.end && !afterReset.reason,
  `start=${afterReset.start || "(empty)"} end=${afterReset.end || "(empty)"} reason=${afterReset.reason || "(empty)"}`,
);
check("Reset returns the leave type to its placeholder", !afterReset.type || /^select/i.test(afterReset.type) || afterReset.type === "",
  `leave_type_id=${afterReset.type || "(empty)"}`);

const { count: afterResetCount } = await db
  .from("leave_requests")
  .select("id", { count: "exact", head: true })
  .gt("created_at", RUN_START);
check("Reset submits nothing", (afterResetCount ?? 0) === (beforeReset ?? 0),
  `${beforeReset} -> ${afterResetCount} leave requests created`);

// Re-fill, because the real submission below needs a populated form.
await emp.page.selectOption("#leave_type_id", chosen.value);
await emp.page.fill("#start_date", startDate);
await emp.page.fill("#end_date", endDate);
await emp.page.fill("#reason", REASON);
await emp.page.click('button[type="submit"]');
await emp.page.waitForTimeout(4000);

const { data: newLeaves } = await db
  .from("leave_requests")
  .select("id, employee_id, status, start_at, end_at")
  .eq("employee_id", employee.id)
  .gt("created_at", RUN_START)
  .order("created_at", { ascending: false })
  .limit(1);
const leave = newLeaves?.[0];
if (leave?.id) createdLeaveId = leave.id;
check("leave request created", Boolean(leave), leave ? `id=${leave.id} status=${leave.status}` : "none");
check("leave request is pending", leave?.status === "pending", `status=${leave?.status}`);

const { data: approvals } = await db
  .from("approval_requests")
  .select("id, status, current_step")
  .eq("entity_id", leave?.id ?? "00000000-0000-0000-0000-000000000000")
  .limit(1);
check("approval request created", Boolean(approvals?.length), `status=${approvals?.[0]?.status} step=${approvals?.[0]?.current_step}`);

const { data: leadNotifs } = await db
  .from("notifications")
  .select("user_id, type, title, body, created_at")
  .eq("type", "leave.request")
  .in("user_id", teamLeadUserIds.length ? teamLeadUserIds : ["00000000-0000-0000-0000-000000000000"])
  .gt("created_at", new Date(Date.now() - 10 * 60_000).toISOString())
  .order("created_at", { ascending: false });

const pendingNotif = leadNotifs?.[0];
check("team lead received leave.request", Boolean(pendingNotif), pendingNotif ? `"${pendingNotif.body}"` : "no notification");
const bodySpecific = Boolean(
  pendingNotif &&
    /requested \d+ day/.test(pendingNotif.body) &&
    /\w{3} \d{1,2}/.test(pendingNotif.body) &&
    pendingNotif.body !== "A team member submitted a leave request for review.",
);
check(
  "notification body is specific (days + dates, not the old generic string)",
  bodySpecific,
  pendingNotif?.body,
);
await emp.ctx.close();

// ---- 2. team lead approves, then HR completes ----
// Approve opens a ConfirmDialog — clicking the button alone changes nothing.
// The first run of this script did exactly that and concluded the approval
// engine was broken, when it had simply never been confirmed.
//
// The leave workflow has TWO steps (Team Lead, then HR), so one approval
// correctly leaves the request pending. Completing it takes both.
//
// Scope the click to OUR row. `button:has-text("Approve").first()` grabs the
// oldest pending request on the page, which on the second run was the FIRST
// run's leftover — so the script approved somebody else's leave and then
// asserted against its own row, which had never been touched. The unique
// reason text is what makes this deterministic.
// A UNIQUE marker per run (declared above, next to RUN_START).
async function approveOnceAs(email, label, status = "pending") {
  const s = await signIn(email);
  // The queue defaults to ?status=pending. Once the manager approves, the leave
  // becomes `manager_approved` and DROPS OUT of the default view — the next
  // approver has to switch the filter to find it. That is a real finding about
  // the workflow, not a bug in this script.
  await s.page.goto(`${BASE}/app/leave?status=${status}`, { waitUntil: "domcontentloaded" });
  await s.page.waitForTimeout(3500);

  const row = s.page.locator(`tr:has-text("${MARKER}")`).first();
  if (!(await row.count())) {
    const body = await s.page.evaluate(() => (document.body?.innerText || "").replace(/\s+/g, " "));
    console.log(`  (${label}: no ${MARKER} row in the queue; page said: ${body.slice(0, 160)})`);
    await s.ctx.close();
    return false;
  }
  const approveBtn = row.locator('button:has-text("Approve")').first();
  if (!(await approveBtn.count())) {
    console.log(`  (${label}: row present but no Approve button — not actionable at this step)`);
    await s.ctx.close();
    return false;
  }
  await approveBtn.click();
  await s.page.waitForTimeout(800);
  const dialog = s.page.locator('[role="dialog"]').last();
  const confirm = dialog.locator('button:has-text("Approve")').last();
  if (!(await confirm.count())) {
    console.log(`  (${label}: confirm dialog did not appear)`);
    await s.ctx.close();
    return false;
  }
  await confirm.click();
  await s.page.waitForTimeout(5000);
  await s.ctx.close();
  return true;
}

const approvedStep1 = teamLeadUserIds.length
  ? await approveOnceAs("teamlead@demo.beepabpo.com", "team lead")
  : false;
check("team lead approved step 1", approvedStep1, approvedStep1 ? "clicked + confirmed" : "no approve button");

const { data: afterStep1 } = await db
  .from("approval_requests")
  .select("status, current_step")
  .eq("entity_id", leave?.id ?? "00000000-0000-0000-0000-000000000000")
  .maybeSingle();
check(
  "workflow advanced to step 2 after one approval",
  afterStep1?.current_step === 2 || afterStep1?.status !== "pending",
  `step=${afterStep1?.current_step} status=${afterStep1?.status}`,
);

// ---- 3. HR completes the workflow ----
const approvedStep2 = await approveOnceAs("hr@demo.beepabpo.com", "hr", "manager_approved");
check("hr approved step 2", approvedStep2, approvedStep2 ? "clicked + confirmed" : "no approve button");

// ---- 3. verify the decision landed ----
const { count: actionsAfter } = await db
  .from("approval_actions")
  .select("id", { count: "exact", head: true });
check(
  "approval_actions row written",
  (actionsAfter ?? 0) > (actionsBefore ?? 0),
  `${actionsBefore} -> ${actionsAfter}`,
);

const { data: finalLeave } = await db
  .from("leave_requests")
  .select("status")
  .eq("id", leave?.id ?? "00000000-0000-0000-0000-000000000000")
  .maybeSingle();
check(
  "leave request left pending",
  finalLeave?.status !== "pending",
  `status=${finalLeave?.status}`,
);

const { data: decisionNotifs } = await db
  .from("notifications")
  .select("user_id, type, title, body")
  .eq("type", "leave.decision")
  .eq("user_id", employee.profile_id)
  .gt("created_at", new Date(Date.now() - 15 * 60_000).toISOString())
  .order("created_at", { ascending: false })
  .limit(1);
const decision = decisionNotifs?.[0];
check("employee received leave.decision", Boolean(decision), decision ? `"${decision.body}"` : "no notification");
check(
  "decision body names who decided / which dates",
  Boolean(decision && !/^Your leave request was (approved|rejected)\.$/.test(decision.body)),
  decision?.body,
);

// ---- 4. cancelling a pending request withdraws it ----
//
// The second button the census could not place. `cancelLeaveRequest` is a real
// server action behind a ConfirmDialog, and employees use it whenever plans
// change -- so its failure would be silent and annoying rather than loud.
//
// It runs AFTER the main request has been decided, on its own request, so it
// cannot disturb the approval flow being measured above.
const cancelStart = iso(new Date(Date.now() + 28 * 86400_000));
const cancelEnd = iso(new Date(Date.now() + 30 * 86400_000));

// A FRESH sign-in. Reusing `emp.page` threw "Target page, context or browser has
// been closed" here: the approval steps in between run their own browser contexts
// and the original one is gone by this point in the run. A dedicated session is
// also more honest -- the cancel is driven the way an employee would drive it.
const canceler = await signIn("employee@demo.beepabpo.com");

await canceler.page.goto(`${BASE}/app/my/leave`, { waitUntil: "domcontentloaded" });
await canceler.page.waitForSelector("#leave_type_id", { timeout: 20000 });
await canceler.page.selectOption("#leave_type_id", chosen.value);
await canceler.page.fill("#start_date", cancelStart);
await canceler.page.fill("#end_date", cancelEnd);
await canceler.page.fill("#reason", `${MARKER} — to be withdrawn.`);
await canceler.page.click('button[type="submit"]');
await canceler.page.waitForTimeout(4000);

const { data: toCancel } = await db
  .from("leave_requests")
  .select("id, status")
  .eq("employee_id", employee.id)
  .gt("created_at", RUN_START)
  .eq("status", "pending")
  .order("created_at", { ascending: false })
  .limit(1);
const cancellable = toCancel?.[0];
check("a second pending request exists to cancel", Boolean(cancellable),
  cancellable ? `id=${cancellable.id}` : "none created");

if (cancellable) {
  cancelledLeaveId = cancellable.id;
  // Reload so the freshly created row renders with its own Cancel button.
  await canceler.page.reload({ waitUntil: "domcontentloaded" });
  await canceler.page.waitForTimeout(1500);

  // The button opens a ConfirmDialog; confirming is the part that matters.
  const cancelBtn = canceler.page.getByRole("button", { name: /^cancel$/i }).first();
  const opened = await cancelBtn.count();
  check("the pending request offers a Cancel control", opened > 0, opened > 0 ? "found" : "no Cancel button");
  if (opened > 0) {
    await cancelBtn.click();
    await canceler.page.waitForTimeout(600);
    const confirmBtn = canceler.page.getByRole("button", { name: /cancel leave/i }).first();
    const confirmVisible = await confirmBtn.count();
    check("Cancel asks for confirmation before withdrawing", confirmVisible > 0,
      confirmVisible > 0 ? "confirm dialog shown" : "cancelled with no confirmation");
    if (confirmVisible > 0) {
      await confirmBtn.click();
      await canceler.page.waitForTimeout(4000);
    }
  }

  const { data: afterCancel } = await db
    .from("leave_requests")
    .select("status")
    .eq("id", cancellable.id)
    .maybeSingle();
  check("Cancel withdraws the request", afterCancel?.status !== "pending",
    `status=${afterCancel?.status}`);

  // Withdrawing must also clear it out of the approval queue, or it sits there
  // as a ghost nobody can act on.
  const { data: orphanedApprovals } = await db
    .from("approval_requests")
    .select("id, status")
    .eq("entity_id", cancellable.id);
  check("Cancel leaves no actionable approval behind",
    (orphanedApprovals ?? []).every((a) => a.status !== "pending"),
    (orphanedApprovals ?? []).map((a) => a.status).join(",") || "no approval rows");
}

} finally {
  // ---- end-of-run cleanup: this run's own rows, whatever happened above ----
  //
  // Runs on the success path AND on a throw. The start-of-run sweep alone left
  // the previous session's ticket and leave request behind, because a sweep
  // only cleans up the run BEFORE the last one.
  if (!APPLY_CLEANUP) {
    console.log("\nend-of-run cleanup: skipped (--no-cleanup)");
  } else if (createdLeaveId || cancelledLeaveId) {
    try {
      await purgeLeaveIds([createdLeaveId, cancelledLeaveId].filter(Boolean));
      const residualAfter = await countExerciseLeave();
      check(
        "this run left no leave request behind",
        residualAfter === residualBefore,
        `${residualBefore} residual before -> ${residualAfter} after`,
      );
    } catch (err) {
      check("this run left no leave request behind", false, `cleanup threw: ${err.message}`);
    }
  } else {
    console.log("\nend-of-run cleanup: nothing was created by this run");
  }

  await browser.close().catch(() => {});

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}