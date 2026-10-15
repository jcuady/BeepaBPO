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
import { readFileSync, existsSync } from "node:fs";

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

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/employee/login`, { waitUntil: "domcontentloaded" });
await page.getByLabel(/email/i).fill(EMAIL);
await page.getByLabel(/^password$/i).fill(e.DEMO_PASSWORD);
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
}

console.log("");
if (exposedCount > 0) {
  console.log(`VERDICT: EXPOSED - ${exposedCount} unapproved payslip(s) still downloadable.`);
  await browser.close();
  process.exit(1);
}
console.log(
  unapproved.length === 0
    ? "VERDICT: CLEAN - no payslip from an unapproved period exists for this employee."
    : `VERDICT: CLOSED - ${refusedCount} unapproved payslip request(s) refused with a non-200 response.`,
);
void body;
await browser.close();