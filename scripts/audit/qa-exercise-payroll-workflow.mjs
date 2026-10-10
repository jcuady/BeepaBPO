// Exercise the payroll money path end to end.
//
// WHY: payroll is the highest-consequence surface in the product and NONE of its
// five actions had ever been driven through the UI. `reviewPayrollPeriod` can
// FINALIZE a period and flip every record in it to finalized — real money state
// — and its rollback branches had never executed.
//
// Isolation: rather than touching the live `finalized` (Sept 1-15) or `draft`
// (Sept 16-30) periods, this opens its OWN period for the current frequency
// window, which does not overlap either. Everything it creates is removed in a
// `finally`, and the one pre-existing value it edits (an employee's base salary)
// is snapshotted and restored exactly.
//
// Usage: node scripts/audit/qa-exercise-payroll-workflow.mjs [--no-cleanup]

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

const base = {
  periods: (await must(db.from("payroll_periods").select("id"), "periods")).length,
  records: (await must(db.from("payroll_records").select("id"), "records")).length,
  payslips: (await must(db.from("payslips").select("id"), "payslips")).length,
};

let periodId = null;
let salaryBackup = null;

async function restore() {
  if (!APPLY_CLEANUP) { console.log("\ncleanup: skipped (--no-cleanup)"); return; }
  if (periodId) {
    const { data: reqs } = await must(
      db.from("approval_requests").select("id").eq("entity_id", periodId), "approval requests",
    );
    const reqIds = (reqs ?? []).map((r) => r.id);
    if (reqIds.length) {
      await db.from("approval_actions").delete().in("request_id", reqIds);
      await db.from("approval_requests").delete().in("id", reqIds);
    }
    // Deliberately NO payslip cleanup. This exercise never creates payslips, and
    // an earlier draft deleted payslips "just in case" for whichever employee it
    // had edited — which would have destroyed real payslip rows. Cleanup must
    // only ever remove rows this run demonstrably created.
    await db.from("payroll_records").delete().eq("payroll_period_id", periodId);
    await db.from("payroll_periods").delete().eq("id", periodId);
  }
  if (salaryBackup) {
    await db.from("payroll_profiles")
      .update({ base_salary: salaryBackup.base_salary, pay_frequency: salaryBackup.pay_frequency })
      .eq("employee_id", salaryBackup.employee_id);
  }

  const now = {
    periods: (await must(db.from("payroll_periods").select("id"), "periods")).length,
    records: (await must(db.from("payroll_records").select("id"), "records")).length,
    payslips: (await must(db.from("payslips").select("id"), "payslips")).length,
  };
  const salaryNow = salaryBackup
    ? await must(db.from("payroll_profiles").select("base_salary, pay_frequency").eq("employee_id", salaryBackup.employee_id).maybeSingle(), "salary now")
    : null;
  const salaryOk = !salaryBackup ||
    (String(salaryNow?.base_salary) === String(salaryBackup.base_salary) && salaryNow?.pay_frequency === salaryBackup.pay_frequency);
  const ok = JSON.stringify(now) === JSON.stringify(base) && salaryOk;
  check(
    "this run left payroll exactly as it found it",
    ok,
    `periods ${base.periods}->${now.periods}, records ${base.records}->${now.records}, payslips ${base.payslips}->${now.payslips}, salary restored=${salaryOk}`,
  );
}

const browser = await chromium.launch();

async function confirmDialog(page, label) {
  await page.waitForTimeout(900);
  const dlg = page.locator('[role="dialog"]').last();
  if (!(await dlg.count())) return false;
  const btn = dlg.getByRole("button", { name: label }).last();
  if (!(await btn.count())) return false;
  await btn.click();
  await page.waitForTimeout(3500);
  return true;
}

try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type=email]', "owner@demo.beepabpo.com");
  await page.fill('input[type=password]', env.DEMO_PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);
  check("signed in as owner (holds payroll.manage)", page.url().includes("/app"), page.url());

  // ---- 1. saveEmployeePayrollSettings ----
  // NOTE: do NOT destructure a `must()` result as `{ data: x }` — it already
  // unwraps `{ data, error }`. Reading `.data` off a row returns undefined,
  // which reads exactly like "no payroll profile exists".
  await page.goto(`${BASE}/app/payroll/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  // The salary inputs render WITHOUT a type attribute, so `input[type="text"]`
  // matches zero elements even though ten inputs are on the page — an attribute
  // selector does not see a DOM property default. Match the id prefix, which is
  // `salary-<employee_id>`, and derive the employee from the row being edited.
  //
  // Snapshotting `payroll_profiles` row 1 and then editing the page's first
  // input edits a DIFFERENT person: the page orders by employee number, the
  // table by primary key. That mismatch left a real salary bumped and
  // unrestored until this run's own verification caught it.
  const salarySelector = 'input[id^="salary-"]';
  const salaryInputs = await page.$$eval(salarySelector, (els) => els.slice(0, 4).map((e) => ({ id: e.id, value: e.value })));
  check("salary settings form rendered", salaryInputs.length > 0, JSON.stringify(salaryInputs.slice(0, 2)));

  if (salaryInputs.length) {
    const targetEmployeeId = salaryInputs[0].id.replace(/^salary-/, "");
    const profileRow = await must(
      db.from("payroll_profiles").select("employee_id, base_salary, pay_frequency").eq("employee_id", targetEmployeeId).maybeSingle(),
      "target profile",
    );
    salaryBackup = profileRow ?? null;
    check("snapshotted the profile of the employee actually being edited", Boolean(salaryBackup),
      `${targetEmployeeId.slice(0, 8)} salary=${salaryBackup?.base_salary}`);

    if (salaryBackup) {
      const first = page.locator(salarySelector).first();
      const original = await first.inputValue();
      const bumped = String(Number(original || "0") + 111);
      await first.fill(bumped);
      const saveBtn = page.getByRole("button", { name: /save/i }).first();
      await saveBtn.click();
      await page.waitForTimeout(4500);
      const saved = await must(
        db.from("payroll_profiles").select("base_salary").eq("employee_id", targetEmployeeId).maybeSingle(), "saved salary",
      );
      check("salary change persisted", String(saved?.base_salary) === bumped,
        `${original} -> ${bumped} (stored ${saved?.base_salary}) for ${targetEmployeeId.slice(0, 8)}`);
    }
  }

  // ---- 2. open a payroll run ----
  await page.goto(`${BASE}/app/payroll/periods`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const periodsBefore = await must(db.from("payroll_periods").select("id, name, status"), "periods before");

  // Pick whichever frequency has not been run yet. The wizard disables one that
  // already has a period, which is itself the overlap guard.
  const freqLabels = ["Monthly", "Weekly", "Semi-monthly"];
  let chosenFreq = null;
  for (const label of freqLabels) {
    const el = page.locator(`label:has-text("${label}")`).first();
    if (!(await el.count())) continue;
    const already = await el.evaluate((node) => node.closest("label")?.textContent ?? "");
    void already;
    await el.click();
    await page.waitForTimeout(800);
    const btn = page.getByRole("button", { name: /continue|next|open|create/i }).first();
    if (await btn.count()) {
      const disabled = await btn.isDisabled();
      if (!disabled) { chosenFreq = label; break; }
    }
  }
  check("a frequency with no existing period is selectable", Boolean(chosenFreq), `chose ${chosenFreq}`);

  if (chosenFreq) {
    await page.getByRole("button", { name: /continue|next/i }).first().click();
    await page.waitForTimeout(1500);
    // steps 2 and 3: cutoff + confirm
    for (let i = 0; i < 3; i += 1) {
      const btn = page.locator('button:has-text("Continue"), button:has-text("Confirm"), button:has-text("Create"), button:has-text("Open")').first();
      if (!(await btn.count())) break;
      if (await btn.isDisabled()) break;
      await btn.click();
      await page.waitForTimeout(3500);
    }
    await page.waitForTimeout(4000);

    const periodsAfter = await must(db.from("payroll_periods").select("id, name, status, start_date, end_date, pay_date"), "periods after");
    const fresh = periodsAfter.filter((p) => !periodsBefore.some((b) => b.id === p.id));
    check("a new payroll period was created", fresh.length === 1, JSON.stringify(fresh[0] ?? null).slice(0, 150));
    periodId = fresh[0]?.id ?? null;
    check("new period starts as draft", fresh[0]?.status === "draft", `status=${fresh[0]?.status}`);

    const recs = periodId
      ? await must(db.from("payroll_records").select("id, employee_id, basic_pay, net_pay, status").eq("payroll_period_id", periodId), "seeded records")
      : [];
    check("payroll records were seeded for the period", recs.length > 0, `${recs.length} record(s), sample pay=${recs[0]?.basic_pay}`);
    check("seeded records start as draft", recs.every((r) => r.status === "draft"), `${recs.filter((r) => r.status === "draft").length}/${recs.length} draft`);

    // ---- 3. recalculate ----
    if (periodId) {
      await page.goto(`${BASE}/app/payroll/periods/${periodId}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      const recalc = page.getByRole("button", { name: "Recalculate" }).first();
      check("Recalculate control present", await recalc.count() > 0);
      if (await recalc.count()) {
        await recalc.click();
        await confirmDialog(page, /Recalculate|Confirm|Run/i);
        await page.waitForTimeout(3000);
        const after = await must(
          db.from("payroll_records").select("id, calculation_snapshot, gross_pay").eq("payroll_period_id", periodId).limit(1), "recalculated",
        );
        check("recalculate produced a calculation snapshot", Boolean(after[0]?.calculation_snapshot),
          after[0]?.calculation_snapshot ? "snapshot written" : "no snapshot");
      }

      // ---- 4. submit for approval ----
      await page.goto(`${BASE}/app/payroll/periods/${periodId}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      const submit = page.getByRole("button", { name: /Submit for approval/i }).first();
      check("Submit for approval present", await submit.count() > 0);
      if (await submit.count()) {
        await submit.click();
        await confirmDialog(page, /Submit|Confirm/i);
        await page.waitForTimeout(4000);
        const p = await must(db.from("payroll_periods").select("status").eq("id", periodId).maybeSingle(), "period status");
        check("period moved to approval", p?.status === "approval", `status=${p?.status}`);

        const reqs = await must(
          db.from("approval_requests").select("id, status").eq("entity_id", periodId), "approval request",
        );
        check("an approval request was created", reqs.length === 1, `${reqs.length} request(s)`);

        // ---- 5. review / approve ----
        // Payroll approval is TWO steps — `approval_steps` has step 1 = finance,
        // step 2 = owner. One approval correctly leaves the period at
        // `approval`; finalizing needs both, exactly like the leave workflow.
        // Asserting after a single click was the first run's mistake.
        let approvals = 0;
        for (let step = 0; step < 3; step += 1) {
          const status = await must(db.from("payroll_periods").select("status").eq("id", periodId).maybeSingle(), "step status");
          if (status?.status === "finalized") break;
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.waitForTimeout(3000);
          const approve = page.locator('button:has-text("Approve")').first();
          if (!(await approve.count())) break;
          await approve.click();
          await confirmDialog(page, /Approve|Confirm/i);
          await page.waitForTimeout(5000);
          approvals += 1;
        }
        const fin = await must(db.from("payroll_periods").select("status, finalized_at").eq("id", periodId).maybeSingle(), "final period");
        check("period finalized after the full approval chain", fin?.status === "finalized",
          `status=${fin?.status} after ${approvals} approval(s)`);
        check("payroll approval took two steps", approvals === 2, `${approvals} approval(s)`);
        const finRecs = await must(db.from("payroll_records").select("status").eq("payroll_period_id", periodId), "final records");
        check("every record in the period is finalized", finRecs.length > 0 && finRecs.every((r) => r.status === "finalized"),
          `${finRecs.filter((r) => r.status === "finalized").length}/${finRecs.length} finalized`);
      }
    }
  }

  check("no console errors during the payroll run", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  await ctx.close();
} finally {
  await restore().catch((e) => console.error("restore failed:", e.message));
  await browser.close().catch(() => {});
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}