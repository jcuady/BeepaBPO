/**
 * End-to-end check that attendance clock times render in the employee's
 * timezone rather than the server's.
 *
 * Reads a real attendance record, then loads the employee page that displays
 * it and asserts the rendered time matches Asia/Manila wall clock for the stored
 * UTC instant. Run against a production build.
 *
 *   BASE_URL=http://localhost:3100 node scripts/audit/verify-attendance-tz.mjs <email>
 */
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
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

// Email lives in auth.users, not profiles.
const listed = await admin.auth.admin.listUsers();
if (listed.error) throw listed.error;
const authUser = listed.data.users.find((u) => u.email === EMAIL);
if (!authUser) throw new Error(`auth user not found for ${EMAIL}`);

const { data: emp } = await admin
  .from("employees")
  .select("id, default_timezone")
  .eq("profile_id", authUser.id)
  .maybeSingle();

if (!emp) {
  console.log(`No employee record linked to ${EMAIL}. Nothing to verify.`);
  process.exit(0);
}

const tz = emp.default_timezone || "Asia/Manila";

// Create our own fixture with a known instant so the assertion is meaningful,
// then remove it. Mirrors test-notification-isolation.mjs: the script owns
// every row it writes.
//
// WHY THE DATE IS FOUND, NOT FIXED
// --------------------------------
// This used to hardcode `WORK_DATE = "2026-09-15"` and exit 1 if a record already
// existed there. Real data has since landed on that date, so the audit failed with
// "A record already exists for 2026-09-15; refusing to overwrite it" -- correctly,
// as a matter of not trampling someone's attendance, and useless as a matter of
// checking anything. An audit that can only run once, and then not again, reads as
// a pass to anyone reading the report rather than the log.
//
// So: walk forward from the original date until a day is free, and derive the
// instants from THAT date. The timezone assertion still holds because midnight UTC
// is 08:00 in Asia/Manila on every date, which is the whole point of the check.
const BASE_DATE = "2026-09-15";

async function findFreeWorkDate() {
  for (let offset = 0; offset < 120; offset++) {
    const d = new Date(`${BASE_DATE}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + offset);
    const iso = d.toISOString().slice(0, 10);
    const { data: clash, error } = await admin
      .from("attendance_records")
      .select("id")
      .eq("employee_id", emp.id)
      .eq("work_date", iso)
      .maybeSingle();
    if (error) throw error;
    if (!clash) return iso;
  }
  throw new Error(`no free attendance work_date within 120 days of ${BASE_DATE}`);
}

const WORK_DATE = await findFreeWorkDate();
const KNOWN_ISO = `${WORK_DATE}T00:00:00.000Z`; // 08:00 in Asia/Manila
const KNOWN_OUT_ISO = `${WORK_DATE}T09:00:00.000Z`;

if (WORK_DATE !== BASE_DATE) {
  console.log(`work_date ${BASE_DATE} is occupied; using ${WORK_DATE} instead.`);
}

const { data: inserted, error: insertErr } = await admin
  .from("attendance_records")
  .insert({
    employee_id: emp.id,
    work_date: WORK_DATE,
    status: "present",
    clock_in_at: KNOWN_ISO,
    clock_out_at: KNOWN_OUT_ISO,
    worked_minutes: 540,
  })
  .select("id")
  .single();

if (insertErr) throw insertErr;
console.log(`Inserted fixture ${inserted.id} for ${WORK_DATE}; will delete it after the check.`);

const cleanup = async () => {
  await admin.from("attendance_records").delete().eq("id", inserted.id);
  console.log("Fixture deleted.");
};

try {
  const expected = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(KNOWN_ISO));

  const expectedOut = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(KNOWN_OUT_ISO));

  console.log(`Employee timezone: ${tz}`);
  console.log(`Stored clock_in_at (UTC): ${KNOWN_ISO}`);
  console.log(`Expected in ${tz}: ${expected} - ${expectedOut}`);
  console.log("");

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${BASE}/employee/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/^password$/i).fill(e.DEMO_PASSWORD);
  await page.getByRole("button", { name: /access portal/i }).click();
  await page.waitForURL(/\/app/, { timeout: 45_000 });

  await page.goto(`${BASE}/app/my/attendance`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  const body = (await page.innerText("body")).replace(/\s+/g, " ");
  const hasIn = body.includes(expected);
  const hasOut = body.includes(expectedOut);

  console.log(`Page contains clock-in  "${expected}": ${hasIn ? "YES" : "NO"}`);
  console.log(`Page contains clock-out "${expectedOut}": ${hasOut ? "YES" : "NO"}`);

  const pass = hasIn && hasOut;
  console.log(
    pass
      ? "VERDICT: PASS"
      : `VERDICT: FAIL - server-local rendering would show ${new Date(KNOWN_ISO).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`,
  );
  await browser.close();
  await cleanup();
  process.exit(pass ? 0 : 1);
} catch (err) {
  await cleanup();
  throw err;
}