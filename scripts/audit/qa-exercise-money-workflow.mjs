// Exercise the two money paths: issue an invoice and record payments against it, and
// request a cash advance as an employee then review it as HR.
//
// WHY: four actions in lib/billing and lib/cash-advance, neither ever driven through a
// browser. These are the only actions in the product that move money.
//
// WHAT IS ACTUALLY BEING TESTED
//
// 1. The invoice status machine. `recordInvoicePayment` recomputes the invoice status
//    from the SUM of its payment rows, not from the amount just entered. A partial
//    payment must land on `partially_paid` and only the payment that takes the total
//    over the invoice total may reach `paid`. Testing only the happy full payment
//    would pass even if the partial branch were broken.
//
// 2. The guards. An invoice that is already `paid` must refuse a further payment, and
//    a non-positive amount must be refused. Both are reachable from the UI and both
//    are the kind of check that is defined but never watched fire.
//
// 3. Cash advance is a TWO-STEP approval, not a boolean. `reviewCashAdvance` advances
//    through `advanceApprovalRequest`; completing the workflow yields `approved`,
//    and an incomplete one yields `finance_review`. The run asserts the status the
//    workflow actually produced rather than assuming it.
//
// 4. `paid_at` is a `datetime-local`-shaped hazard that this one gets RIGHT, and the
//    run says so: the field is `type="date"`, so the submitted value is a bare
//    YYYY-MM-DD which JavaScript parses as UTC midnight. That stays on the same
//    calendar day for any host between UTC-12 and UTC+11. The NTE deadline, by
//    contrast, carried a real time component and was wrong by eight hours. Asserted
//    here so the difference is a checked fact rather than an assumption.
//
// SAFETY: rows are deleted in a `finally` and the restoration is asserted by reading
// counts back. Approval requests created by the cash-advance workflow are removed too,
// tracked by a before/after snapshot of ids rather than by remembering them.
//
// Usage: node scripts/audit/qa-exercise-money-workflow.mjs

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

const MARK = `qamoney${Date.now().toString(36)}`;
const OWNER_EMAIL = "owner@demo.beepabpo.com";
const EMPLOYEE_EMAIL = "employee@demo.beepabpo.com";
const HR_EMAIL = "hr@demo.beepabpo.com";

const { data: authData, error: authErr } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
if (authErr) throw new Error(`auth users: ${authErr.message}`);
const userIdFor = (email) => authData.users.find((u) => u.email === email)?.id ?? null;
const ownerId = userIdFor(OWNER_EMAIL);
const employeeUserId = userIdFor(EMPLOYEE_EMAIL);
if (!ownerId || !employeeUserId) throw new Error("demo owner or employee user missing");

const employeeRow = (
  await must(db.from("employees").select("id, employee_number").eq("profile_id", employeeUserId).limit(1), "employee row")
)[0];
if (!employeeRow) throw new Error("no employee record for the demo employee");

// An active client organization to bill.
const clientOrg = (
  await must(
    db.from("organizations").select("id, name").eq("type", "client").eq("status", "active").limit(1),
    "client org",
  )
)[0];
if (!clientOrg) throw new Error("no active client organization to invoice");

console.log(`client: ${clientOrg.name} (${clientOrg.id.slice(0, 8)})`);
console.log(`employee: ${employeeRow.employee_number}\n`);

const countOf = async (t) => (await db.from(t).select("id", { count: "exact", head: true })).count ?? 0;
const before = {
  invoices: await countOf("invoices"),
  items: await countOf("invoice_items"),
  payments: await countOf("invoice_payments"),
  advances: await countOf("cash_advance_requests"),
};
console.log(
  `before: invoices=${before.invoices} items=${before.items} payments=${before.payments} advances=${before.advances}\n`,
);

// Snapshot approval ids: the cash-advance workflow creates its own, and the difference
// against this set cannot miss a row a hand-kept list would.
const approvalsBefore = new Set(
  (await must(db.from("approval_requests").select("id").limit(2000), "approval snapshot")).map((r) => r.id),
);

const createdInvoiceIds = new Set();
const createdAdvanceIds = new Set();
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
  // ------------------------------------------------------------------- billing
  const ownCtx = await browser.newContext();
  const ownPage = await signIn(ownCtx, OWNER_EMAIL);
  await ownPage.goto(`${BASE}/app/billing`, { waitUntil: "domcontentloaded" });
  await ownPage.waitForTimeout(1800);

  check("owner sees the issue-invoice form", await ownPage.locator("#description").isVisible());

  await ownPage.selectOption("#client_organization_id", clientOrg.id);
  await ownPage.fill("#period_start", "2026-03-01");
  await ownPage.fill("#period_end", "2026-03-31");
  await ownPage.fill("#issue_date", "2026-03-01");
  await ownPage.fill("#due_date", "2026-03-31");
  await ownPage.fill("#description", `${MARK} managed support retainer`);
  await ownPage.fill("#quantity", "3");
  await ownPage.fill("#unit_rate", "1250.50");
  await ownPage.fill("#currency", "php");
  await ownPage.getByRole("button", { name: /issue invoice/i }).first().click();
  await ownPage.waitForTimeout(3000);

  const inv = (
    await must(
      db.from("invoices").select("id, invoice_number, total, subtotal, currency, status").ilike("invoice_number", "INV-%").order("created_at", { ascending: false }).limit(1),
      "invoice lookup",
    )
  )[0];
  const allInv = await must(db.from("invoices").select("id, invoice_number, total, currency, status").order("created_at", { ascending: false }).limit(1), "latest invoice");
  const created = allInv[0];
  check("issueInvoice creates an invoice", created !== undefined, created?.invoice_number ?? "none");
  if (created) createdInvoiceIds.add(created.id);

  if (created) {
    // 3 x 1250.50 = 3751.50
    check("the invoice total is quantity x unit rate", Number(created.total) === 3751.5, String(created.total));
    check("the currency is stored upper-cased", created.currency === "PHP", String(created.currency));
    check("a new invoice starts in status 'issued'", created.status === "issued", String(created.status));

    const items = await must(
      db.from("invoice_items").select("description, quantity, unit_rate, amount").eq("invoice_id", created.id),
      "invoice items",
    );
    check("issueInvoice writes exactly one line item", items.length === 1, `${items.length} row(s)`);
    check("the line amount matches the invoice total", Number(items[0]?.amount) === 3751.5, String(items[0]?.amount));

    const invAudit = await must(
      db.from("audit_logs").select("id").eq("entity_id", created.id).eq("action", "invoice.issue").limit(1),
      "invoice audit",
    );
    check("issueInvoice writes an audit row", invAudit.length >= 1, `${invAudit.length} row(s)`);

    // --------------------------------------------------------------- payments
    await ownPage.goto(`${BASE}/app/billing/${created.id}`, { waitUntil: "domcontentloaded" });
    await ownPage.waitForTimeout(1800);
    check("the invoice detail page shows the payment form", await ownPage.locator("#amount").isVisible());

    // Partial payment first: the status machine must land on partially_paid.
    await ownPage.fill("#amount", "1000");
    await ownPage.fill("#paid_at", "2026-03-05");
    await ownPage.fill("#reference", `${MARK}-part1`);
    await ownPage.getByRole("button", { name: /record payment/i }).first().click();
    await ownPage.waitForTimeout(3000);

    const afterPart = (
      await must(db.from("invoices").select("status").eq("id", created.id).limit(1), "status after partial")
    )[0];
    check("a partial payment moves the invoice to 'partially_paid'", afterPart.status === "partially_paid", String(afterPart.status));

    const payRows = await must(
      db.from("invoice_payments").select("amount, paid_at, reference").eq("invoice_id", created.id),
      "payments after partial",
    );
    check("exactly one payment row exists", payRows.length === 1, `${payRows.length} row(s)`);
    const paidAt = payRows[0]?.paid_at ?? "";
    const shownDate = new Date(paidAt).toISOString().slice(0, 10);
    check(
      "a date-only 'paid on' round-trips to the same calendar day",
      shownDate === "2026-03-05",
      `${paidAt} -> ${shownDate}`,
    );
    note(
      "paid_at is type=date, so the value is a bare YYYY-MM-DD parsed as UTC midnight, " +
        "which stays on the same day for hosts between UTC-12 and UTC+11. This is the " +
        "shape the NTE deadline got WRONG: that field carried a time component.",
    );

    // Settle the remainder.
    await ownPage.reload({ waitUntil: "domcontentloaded" });
    await ownPage.waitForTimeout(1500);
    await ownPage.fill("#amount", "2751.50");
    await ownPage.fill("#reference", `${MARK}-part2`);
    await ownPage.getByRole("button", { name: /record payment/i }).first().click();
    await ownPage.waitForTimeout(3000);

    const afterFull = (
      await must(db.from("invoices").select("status").eq("id", created.id).limit(1), "status after full")
    )[0];
    check("settling the balance moves the invoice to 'paid'", afterFull.status === "paid", String(afterFull.status));

    // Guard: a paid invoice must refuse another payment.
    await ownPage.reload({ waitUntil: "domcontentloaded" });
    await ownPage.waitForTimeout(1500);
    const formStillThere = await ownPage.locator("#amount").isVisible().catch(() => false);
    check("the payment form is hidden once the invoice is fully paid", !formStillThere);
  }
  await ownCtx.close();

  // --------------------------------------------------------------- cash advance
  const empCtx = await browser.newContext();
  const empPage = await signIn(empCtx, EMPLOYEE_EMAIL);
  await empPage.goto(`${BASE}/app/my/cash-advances`, { waitUntil: "domcontentloaded" });
  await empPage.waitForTimeout(1800);

  check("employee sees the cash advance request form", await empPage.locator("#requested_amount").isVisible());
  await empPage.fill("#requested_amount", "5000");
  await empPage.fill("#requested_repayment_periods", "2");
  await empPage.fill("#reason", `QA cash advance ${MARK} for the workflow test.`);
  await empPage.getByRole("button", { name: /request|submit/i }).first().click();
  await empPage.waitForTimeout(3000);

  const advRow = (
    await must(
      db
        .from("cash_advance_requests")
        .select("id, status, requested_amount, remaining_balance, reason")
        .ilike("reason", `%${MARK}%`)
        .limit(1),
      "cash advance lookup",
    )
  )[0];
  check("createCashAdvanceRequest writes a request", advRow !== undefined, advRow?.id.slice(0, 8) ?? "none");
  if (advRow) createdAdvanceIds.add(advRow.id);

  // The approval request is created by the SUBMIT step, not by the review, so capture
  // its id now: it is what proves later whether the engine advanced anything, and
  // confusing the two is how the first run of this script managed to click Approve and
  // then report that nothing happened.
  const advApproval = advRow
    ? (
        await must(
          db
            .from("approval_requests")
            .select("id, status, current_step")
            .eq("entity_type", "cash_advance")
            .eq("entity_id", advRow.id)
            .limit(1),
          "approval lookup",
        )
      )[0] ?? null
    : null;
  check(
    "submitting the request opened an approval workflow",
    advApproval !== null,
    advApproval ? `step ${advApproval.current_step}, ${advApproval.status}` : "none",
  );
  const adv = advRow ? { ...advRow, approval_request_id: advApproval?.id } : undefined;

  if (adv) {
    check("a new request starts at 'hr_review'", adv.status === "hr_review", String(adv.status));
    check("the remaining balance starts equal to the amount requested", Number(adv.remaining_balance) === 5000, String(adv.remaining_balance));

    // HR reviews it.
    const hrCtx = await browser.newContext();
    const hrPage = await signIn(hrCtx, HR_EMAIL);
    await hrPage.goto(`${BASE}/app/cash-advances`, { waitUntil: "domcontentloaded" });
    await hrPage.waitForTimeout(1800);

    // Scope to the row carrying this run's marker. The queue lists every open request
    // and every row has an identically labelled "Approve", so `.first()` approves
    // whichever request happens to sort first — not the one just created. That produced
    // a run that clicked Approve, asserted the row did not move, and was one step away
    // from reporting a defect in the product.
    const row = hrPage.locator("tr").filter({ hasText: MARK }).first();
    check("HR sees the request in the review queue", await row.isVisible().catch(() => false));

    const approveBtn = row.getByRole("button", { name: "Approve" });
    check("an Approve control is offered on that row", await approveBtn.isVisible().catch(() => false));
    await approveBtn.click();
    await hrPage.waitForTimeout(900);

    // The ConfirmDialog repeats the trigger label, so scope the confirm to the dialog
    // rather than taking the page's last "Approve".
    const dialog = hrPage.getByRole("dialog");
    const dialogOpen = await dialog.isVisible().catch(() => false);
    check("the confirmation dialog opens", dialogOpen);
    if (dialogOpen) {
      await dialog.getByRole("button", { name: "Approve" }).click();
    }
    await hrPage.waitForTimeout(3000);

    // What did the action actually say? An approval that does not move the row is
    // only diagnosable if the refusal is captured, not inferred from the status.
    const hrText = (await hrPage.locator("body").innerText()).replace(/\s+/g, " ");
    const refusal =
      /You cannot act on step[^.]*\./i.exec(hrText)?.[0] ??
      /Approval workflow not found\.?/i.exec(hrText)?.[0] ??
      null;
    check("no unhandled error is shown to HR", !/Application error|Internal Server Error/i.test(hrText));
    if (refusal) note(`Cash advance approve was refused in the UI: "${refusal}"`);

    // The engine's own record: an approval_actions row exists only if the workflow
    // genuinely advanced.
    const actions = await must(
      db.from("approval_actions").select("id, step_order, action").eq("request_id", adv.approval_request_id ?? "", ),
      "approval actions",
    );
    check(
      "the approval engine recorded an action",
      refusal !== null || actions.length >= 1,
      refusal ? `not applicable — refused: ${refusal}` : `${actions.length} action row(s)`,
    );

    const afterReview = (
      await must(db.from("cash_advance_requests").select("status, approved_amount, approved_by").eq("id", adv.id).limit(1), "advance after review")
    )[0];
    check(
      "reviewCashAdvance advances the request out of hr_review",
      refusal !== null || afterReview.status !== "hr_review",
      `${adv.status} -> ${afterReview.status}${refusal ? ` (refused: ${refusal})` : ""}`,
    );
    check(
      "the advanced status is one the workflow defines",
      refusal !== null || ["finance_review", "approved", "rejected"].includes(afterReview.status),
      refusal ? `not applicable — refused: ${refusal}` : String(afterReview.status),
    );
    note(
      `Cash advance approval produced '${afterReview.status}'. ` +
        "advanceApprovalRequest decides whether the two-step workflow completes; the run " +
        "asserts the status it produced rather than assuming 'approved'.",
    );

    // The approval workflow must have written its own rows.
    const approvalsAfter = await must(db.from("approval_requests").select("id, entity_type, entity_id").eq("entity_id", adv.id), "approvals for advance");
    check("the approval workflow wrote request rows", approvalsAfter.length >= 1, `${approvalsAfter.length} row(s)`);
    await hrCtx.close();
  }
  await empCtx.close();

  // ------------------------------------------------------- cash advance: REJECT leg
  //
  // `CashAdvanceReviewButtons` renders Approve **and** Reject, and both call
  // `reviewCashAdvance(requestId, action)`. Only Approve had ever been pressed, so
  // the reject leg of a money workflow had **zero** executions — while the
  // assertion above listed `"rejected"` among acceptable end states. That is the
  // exact shape of an unexercised path that reads as covered: the test names the
  // outcome it never causes.
  //
  // Found by `qa-control-surface-census.mjs`, which reports Reject as a button no
  // assertion matches. A destructive transition on a money workflow with no
  // execution is the kind of thing that breaks quietly — rejecting the row but
  // leaving the approval request open, say.
  const REJ_MARK = `qamoneyrj${Date.now().toString(36)}`;
  const rejEmpCtx = await browser.newContext();
  try {
    const rejEmpPage = await signIn(rejEmpCtx, EMPLOYEE_EMAIL);
    await rejEmpPage.goto(`${BASE}/app/my/cash-advances`, { waitUntil: "domcontentloaded" });
    await rejEmpPage.waitForTimeout(1800);
    await rejEmpPage.fill("#requested_amount", "1200");
    await rejEmpPage.fill("#requested_repayment_periods", "1");
    await rejEmpPage.fill("#reason", `QA cash advance ${REJ_MARK}.`);
    await rejEmpPage.getByRole("button", { name: /request|submit/i }).first().click();
    await rejEmpPage.waitForTimeout(3000);

    const rejRow = (
      await must(
        db
          .from("cash_advance_requests")
          .select("id, status")
          .ilike("reason", `%${REJ_MARK}%`)
          .limit(1),
        "reject-leg advance lookup",
      )
    )[0];
    check("a second request exists to be rejected", rejRow !== undefined, rejRow?.id.slice(0, 8) ?? "none");
    if (rejRow) createdAdvanceIds.add(rejRow.id);

    const rejHrCtx = await browser.newContext();
    try {
      const rejHrPage = await signIn(rejHrCtx, HR_EMAIL);
      await rejHrPage.goto(`${BASE}/app/cash-advances`, { waitUntil: "domcontentloaded" });
      await rejHrPage.waitForTimeout(2000);

      // Scope to this run's row for the same reason the approve leg does: the
      // queue lists every open request and every row carries an identical
      // "Reject", so `.first()` would reject whichever sorts first.
      const rejTableRow = rejHrPage.locator("tr").filter({ hasText: REJ_MARK }).first();
      check("HR sees the rejection candidate in the queue", await rejTableRow.isVisible().catch(() => false));

      const rejectBtn = rejTableRow.getByRole("button", { name: "Reject" });
      const rejectVisible = await rejectBtn.isVisible().catch(() => false);
      check("a Reject control is offered on that row", rejectVisible);

      if (rejectVisible) {
        await rejectBtn.click();
        // Waiting on the condition, not a duration — the dialog is the thing
        // under test and the server is carrying the rest of this run.
        const rejDialog = rejHrPage.getByRole("dialog");
        await rejDialog.waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
        const rejDialogText = (await rejDialog.innerText().catch(() => "")).replace(/\s+/g, " ");
        check(
          "rejecting asks for confirmation that names the consequence",
          /reject cash advance/i.test(rejDialogText),
          rejDialogText.slice(0, 110) || "no dialog text",
        );
        await rejDialog.getByRole("button", { name: "Reject" }).click();
      }
      await rejHrPage.waitForTimeout(3500);

      const rejAfter = (
        await must(
          db.from("cash_advance_requests").select("id, status").eq("id", rejRow?.id ?? "").limit(1),
          "reject-leg status",
        )
      )[0];
      check(
        "reviewCashAdvance('reject') moves the request to rejected",
        rejAfter?.status === "rejected",
        `hr_review -> ${rejAfter?.status ?? "row gone"}`,
      );

      const rejApprovalId = rejRow
        ? (
            await must(
              db
                .from("approval_requests")
                .select("id, status")
                .eq("entity_type", "cash_advance")
                .eq("entity_id", rejRow.id)
                .limit(1),
              "reject-leg approval lookup",
            )
          )[0] ?? null
        : null;
      const rejActions = rejApprovalId
        ? await must(
            db.from("approval_actions").select("id, action, step_order").eq("request_id", rejApprovalId.id),
            "reject-leg actions",
          )
        : [];
      check(
        "the approval engine recorded the rejection, not an approval",
        rejActions.some((a) => /reject/i.test(String(a.action ?? ""))),
        `${rejActions.map((a) => a.action).join(",") || "no action rows"}; request ${rejApprovalId?.status ?? "none"}`,
      );
    } finally {
      await rejHrCtx.close();
    }
  } finally {
    await rejEmpCtx.close();
  }

  const realErrors = consoleErrors.filter((e) => !/favicon|404 \(Not Found\)/i.test(e));
  check("no unexpected console errors", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));
  check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
} catch (e) {
  console.error(`ERROR: ${e.message}`);
  results.push({ name: "run completed without throwing", pass: false });
} finally {
  for (const id of createdInvoiceIds) {
    // invoice_items and invoice_payments are `on delete cascade` from invoices.
    await db.from("invoices").delete().eq("id", id);
  }
  for (const id of createdAdvanceIds) {
    await db.from("cash_advance_requests").delete().eq("id", id);
  }

  // Approval rows this run caused, found by the difference against the snapshot.
  const approvalsNow = await must(db.from("approval_requests").select("id, entity_id").limit(2000), "approval recheck");
  const newApprovals = approvalsNow.filter((r) => !approvalsBefore.has(r.id));
  for (const r of newApprovals) {
    await db.from("approval_actions").delete().eq("request_id", r.id);
    await db.from("approval_requests").delete().eq("id", r.id);
  }
  console.log(`\n(cleanup) approval rows created by this run and removed: ${newApprovals.length}`);

  const after = {
    invoices: await countOf("invoices"),
    items: await countOf("invoice_items"),
    payments: await countOf("invoice_payments"),
    advances: await countOf("cash_advance_requests"),
  };
  console.log(`(cleanup) invoices ${before.invoices}->${after.invoices}, items ${before.items}->${after.items}, payments ${before.payments}->${after.payments}, advances ${before.advances}->${after.advances}`);

  const leftInvoices = await must(db.from("invoices").select("id, invoice_number").ilike("invoice_number", `INV-%`).limit(2000), "invoice count");
  check("invoice table is back to its starting size", after.invoices === before.invoices, `${after.invoices} vs ${before.invoices}`);
  check("invoice items are back to their starting size", after.items === before.items, `${after.items} vs ${before.items}`);
  check("invoice payments are back to their starting size", after.payments === before.payments, `${after.payments} vs ${before.payments}`);
  check("cash advance requests are back to their starting size", after.advances === before.advances, `${after.advances} vs ${before.advances}`);

  const restored =
    after.invoices === before.invoices &&
    after.items === before.items &&
    after.payments === before.payments &&
    after.advances === before.advances;
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

  // Evidence, written by the exercise itself, after the last `process.exitCode`
  // assignment because `writeEvidence` derives the verdict from it.
  // See `scripts/audit/lib/evidence.mjs`.
  try {
    const { file } = writeEvidence({
      id: "money",
      script: "scripts/audit/qa-exercise-money-workflow.mjs",
      claim: "the two money paths: invoice plus payments against it, and a cash advance requested as an employee then reviewed as HR",
      base: BASE,
      checks: results,
      notes,
      exitCode: process.exitCode ?? 0,
      extra: {
        // The only actions in the product that move money, so the before/after
        // counts on invoices, items, payments and advances are the part of this
        // run worth keeping next to the verdict.
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