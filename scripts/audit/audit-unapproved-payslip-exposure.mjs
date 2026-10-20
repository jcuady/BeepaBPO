/**
 * Can an employee actually see a payslip from an unapproved payroll period?
 *
 * `/app/my/payroll` lists records in (finalized|paid|approved) and the PDF
 * route serves the same statuses. Payroll *record* status is set independently
 * of payroll *period* status, so a period still in `draft` can expose payslips
 * to employees before anyone approved the run.
 *
 * Logs in as the demo employee and reports what they can actually see. Read-only
 * apart from the login itself.
 */
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fillHeld } from "./lib/browser-form.mjs";

const EVIDENCE = "docs/evidence/payslip-exposure.json";

/**
 * Write this audit's verdict to disk.
 *
 * WHY
 * ---
 * This is a payroll data-exposure check — the question is whether an employee
 * can download a payslip for a period nobody has approved yet. It is also the
 * check most likely to be re-run and quoted: "payslips from unapproved periods
 * are refused" is the sort of sentence that ends up in a security summary with
 * no way back to the measurement.
 *
 * `unapprovedCount` is the field that matters most. Zero unapproved records
 * means this run proved nothing about the refusal path — it was CLEAN because
 * there was nothing to refuse. Recording the denominator keeps that honest: a
 * reader can see `verdict: closed, unapprovedCount: 0` and know the gate had
 * no opportunity to fire, which is the same distinction `verify-attendance-tz`
 * needed for its own empty fixture.
 */
function writeEvidence(exitCode, verdict, verdictText, data = {}) {
  mkdirSync("docs/evidence", { recursive: true });
  writeFileSync(
    EVIDENCE,
    JSON.stringify(
      {
        check: "payslip-exposure",
        generatedAt: new Date().toISOString(),
        base: BASE,
        email: EMAIL,
        verdict,
        verdictText,
        recordCount: 0,
        unapprovedCount: 0,
        exposedCount: 0,
        refusedCount: 0,
        downloadLinksListed: 0,
        unapproved: [],
        ...data,
        exitCode,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`wrote ${EVIDENCE}`);
}

const BASE = process.env.QA_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3100";
const EMAIL = process.argv[2] ?? "employee@demo.beepabpo.com";

function env() {
  const out = {};
  if (!existsSync(".env.local")) return out;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let x = line.slice(i + 1).trim();
    if ((x.startsWith('"') && x.endsWith('"')) || (x.startsWith("'") && x.endsWith("'"))) x = x.slice(1, -1);
    out[line.slice(0, i).trim()] = x;
  }
  return out;
}

const e = env();
const admin = createClient(
  e.NEXT_PUBLIC_SUPABASE_URL,
  e.SUPABASE_SECRET_KEY ?? e.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const listed = await admin.auth.admin.listUsers();
const authUser = listed.data.users.find((u) => u.email === EMAIL);
if (!authUser) throw new Error(`auth user not found for ${EMAIL}`);

const { data: emp } = await admin
  .from("employees")
  .select("id")
  .eq("profile_id", authUser.id)
  .maybeSingle();
if (!emp) {
  console.log(`No employee record for ${EMAIL}.`);
  // Exiting 0 here is correct for the product (nothing to check) but it is not a
  // pass for the CHECK, and the difference has to survive in the file: an absent
  // employee record means the exposure question was not asked at all.
  writeEvidence(2, "unknown", `no employee record for ${EMAIL}; nothing was verified`, {
    recordCount: null,
    unapprovedCount: null,
  });
  process.exit(0);
}

const { data: mine } = await admin
  .from("payroll_records")
  .select("id, status, net_pay, payroll_period_id, payroll_periods(name, status)")
  .eq("employee_id", emp.id);

const visible = (mine ?? []).filter((r) => ["finalized", "paid", "approved"].includes(r.status));
const unapproved = visible.filter((r) => r.payroll_periods && r.payroll_periods.status !== "finalized" && r.payroll_periods.status !== "disbursed" && r.payroll_periods.status !== "closed");

console.log(`Records for ${EMAIL}: ${mine?.length ?? 0}`);
for (const r of mine ?? []) {
  console.log(
    `  record ${r.status.padEnd(10)} net ${String(r.net_pay).padStart(8)}  period "${r.payroll_periods?.name}" (${r.payroll_periods?.status})`,
  );
}
console.log("");

/**
 * The browser work is wrapped, because a gate that crashes must not leave the
 * PREVIOUS run's evidence file in place.
 *
 * WHY: `docs/evidence/payslip-exposure.json` is read as this gate's result. If
 * this script throws before it writes — a dead server, a browser that will not
 * launch, a sign-in that times out — the old file survives: dated, parseable,
 * and describing a build that no longer exists. Nothing in it says "this was
 * not measured now", and a reader has no way to tell it from a fresh result.
 *
 * `verify-attendance-tz.mjs` and `smoke-cron.mjs` already guard their runs
 * this way. This is the same guard for the same failure: the evidence is
 * written with the verdict `unknown`, which says "this run did not complete"
 * rather than "here is a measurement".
 */
let browser = null;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${BASE}/employee/login`, { waitUntil: "domcontentloaded" });
  await fillHeld(page, page.getByLabel(/email/i), EMAIL);
  await fillHeld(page, page.getByLabel(/^password$/i), e.DEMO_PASSWORD);
  await page.getByRole("button", { name: /access portal/i }).click();
  await page.waitForURL(/\/app/, { timeout: 45_000 });

  await page.goto(`${BASE}/app/my/payroll`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const body = (await page.innerText("body")).replace(/\s+/g, " ");
  // The control is an <a>Download PDF</a> link, not a button.
  const downloadLinks = await page.getByRole("link", { name: /download pdf/i }).count();

  console.log(`/app/my/payroll lists ${downloadLinks} payslip download link(s).`);
  console.log("");

  // The verdict must come from what the download route actually does, not from
  // whether an unapproved record exists. An earlier version of this script
  // reported EXPOSED purely because the row was present, and kept saying so even
  // after the route correctly returned 403.
  let exposedCount = 0;
  let refusedCount = 0;

  const unapprovedResults = [];
  for (const r of unapproved) {
    console.log(`Unapproved period: "${r.payroll_periods?.name}" (status ${r.payroll_periods?.status}), net ${r.net_pay}`);
    const res = await page.request.get(`${BASE}/app/my/payroll/${r.id}/payslip`, { maxRedirects: 0 });
    const type = res.headers()["content-type"] ?? "";
    const leaked = res.status() === 200 && type.includes("application/pdf");
    console.log(`  GET payslip -> HTTP ${res.status()} ${type} ${leaked ? "LEAKED" : "refused"}`);
    if (leaked) exposedCount += 1;
    else refusedCount += 1;

    // It must also be absent from the list the employee sees. Check this
    // specific record, not merely "are there any download links" — the page may
    // legitimately list an approved payslip at the same time.
    const listedHere = await page.locator(`a[href*="/payslip"]`).evaluateAll(
      (els, id) => els.filter((el) => el.getAttribute("href")?.includes(id)).length,
      r.id,
    );
    console.log(`  this record listed on /app/my/payroll: ${listedHere > 0 ? "YES (should not be)" : "no"}`);
    if (listedHere > 0) exposedCount += 1;

    // The status code AND the listing are both recorded. "Refused with 403" and
    // "refused with 404" are equally closed, but only one of them tells a reader
    // whether the record is merely hidden from the list or absent server-side.
    unapprovedResults.push({
      recordId: r.id,
      period: r.payroll_periods?.name ?? null,
      periodStatus: r.payroll_periods?.status ?? null,
      getStatus: res.status(),
      contentType: type,
      leaked,
      listedOnPayrollPage: listedHere > 0,
    });
  }

  console.log("");
  const shared = {
    recordCount: mine?.length ?? 0,
    unapprovedCount: unapproved.length,
    downloadLinksListed: downloadLinks,
    unapproved: unapprovedResults,
  };
  if (exposedCount > 0) {
    console.log(`VERDICT: EXPOSED - ${exposedCount} unapproved payslip(s) still downloadable.`);
    writeEvidence(1, "exposed", `${exposedCount} unapproved payslip(s) still downloadable`, {
      ...shared,
      exposedCount,
      refusedCount,
    });
    await browser.close();
    process.exit(1);
  }
  const verdictText =
    unapproved.length === 0
      ? "CLEAN - no payslip from an unapproved period exists for this employee"
      : `CLOSED - ${refusedCount} unapproved payslip request(s) refused with a non-200 response`;
  console.log(
    unapproved.length === 0
      ? "VERDICT: CLEAN - no payslip from an unapproved period exists for this employee."
      : `VERDICT: CLOSED - ${refusedCount} unapproved payslip request(s) refused with a non-200 response.`,
  );
  writeEvidence(0, unapproved.length === 0 ? "clean" : "closed", verdictText, {
    ...shared,
    exposedCount: 0,
    refusedCount,
  });
  void body;
  await browser.close();
} catch (err) {
  // The browser is closed before the error propagates, so a crash does not
  // leave a Chromium process behind.
  if (browser) await browser.close().catch(() => {});
  writeEvidence(2, "unknown", `could not complete: ${String(err.message).split("\n")[0]}`, {
    recordCount: mine?.length ?? 0,
    unapprovedCount: unapproved.length,
  });
  console.error(err);
  process.exit(1);
}