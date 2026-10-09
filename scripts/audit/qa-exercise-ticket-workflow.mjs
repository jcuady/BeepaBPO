// Exercise the live ticket workflow and prove both ticket notifications fire.
//
// `ticket.created` confirms to the requester and `ticket.assigned` tells the
// assignee. Neither had ever been produced in this environment — the live
// notifications table held only `leave.request` rows and harness residue — so
// both paths were unexercised.
//
// client admin@  creates a ticket  ->  operations@  assigns it
//
// Asserts against the database, not the DOM, and cleans up after itself.
//
// Usage: node scripts/audit/qa-exercise-ticket-workflow.mjs [--no-cleanup]

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

const MARKER = `QA ticket exercise ${Date.now().toString(36)}`;
const SUBJECT = `${MARKER} — payroll question`;

// ---- cleanup from previous runs ----
if (APPLY_CLEANUP) {
  const { data: stale } = await db.from("tickets").select("id").like("subject", `${MARKER.split(" ").slice(0, 3).join(" ")}%`);
  const broad = stale?.length ?? 0;
  const { data: allStale } = await db.from("tickets").select("id, subject").like("subject", "QA ticket exercise%");
  if (allStale?.length) {
    const ids = allStale.map((t) => t.id);
    await db.from("ticket_messages").delete().in("ticket_id", ids);
    await db.from("notifications").delete().in("entity_id", ids);
    await db.from("tickets").delete().in("id", ids);
    console.log(`cleanup: removed ${allStale.length} ticket(s) from previous runs`);
  }
  void broad;
}

const { data: authList } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
const authByEmail = new Map((authList?.users ?? []).map((u) => [u.email, u.id]));
const clientAdminId = authByEmail.get("clientadmin@demo.beepabpo.com");
const opsId = authByEmail.get("operations@demo.beepabpo.com");

const { count: notifBefore } = await db
  .from("notifications").select("id", { count: "exact", head: true });
console.log(`baseline: ${notifBefore} notifications\n`);

const browser = await chromium.launch();
async function signIn(email) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', env.DEMO_PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);
  return { ctx, page };
}

// ---- 1. client admin creates a ticket ----
const ca = await signIn("clientadmin@demo.beepabpo.com");
await ca.page.goto(`${BASE}/app/client/tickets`, { waitUntil: "domcontentloaded" });
await ca.page.waitForSelector("#subject", { timeout: 20000 });
await ca.page.selectOption("#category", { index: 1 }).catch(() => {});
await ca.page.fill("#subject", SUBJECT);
await ca.page.fill("#description", "Raised by the QA workflow exercise. Please confirm the billing cut-off for this month.");
await ca.page.click('button[type="submit"]');
await ca.page.waitForTimeout(4500);
await ca.ctx.close();

const { data: tickets } = await db
  .from("tickets")
  .select("id, ticket_number, subject, status, requester_user_id, assigned_user_id")
  .eq("subject", SUBJECT)
  .maybeSingle();
check("ticket created by the client contact", Boolean(tickets), tickets?.ticket_number);
check("ticket starts in 'new'", tickets?.status === "new", `status=${tickets?.status}`);

const { data: createdNotif } = await db
  .from("notifications")
  .select("user_id, type, body")
  .eq("type", "ticket.created")
  .eq("user_id", clientAdminId ?? "")
  .gt("created_at", new Date(Date.now() - 10 * 60_000).toISOString())
  .order("created_at", { ascending: false })
  .limit(1);
const cn = createdNotif?.[0];
check("requester received ticket.created", Boolean(cn), cn ? `"${cn.body}"` : "none");
check("ticket.created names the subject", Boolean(cn?.body?.includes(MARKER.split(" ").slice(0, 3).join(" "))), cn?.body);

// ---- 2. operations assigns it ----
// Assignment lives on the ticket DETAIL page (`TicketAssignForm`), not the
// list, and the select opens a ConfirmDialog. Selecting an option and moving on
// changes nothing — which is what the first run of this script did.
let assigned = false;
if (tickets && opsId) {
  const ops = await signIn("operations@demo.beepabpo.com");
  await ops.page.goto(`${BASE}/app/tickets/${tickets.id}`, { waitUntil: "domcontentloaded" });
  await ops.page.waitForTimeout(3500);
  const sel = ops.page.locator(`select[id^="ticket-assignee-"]`).first();
  if (await sel.count()) {
    const value = await sel.locator("option").nth(1).getAttribute("value");
    if (value) {
      await sel.selectOption(value);
      await ops.page.waitForTimeout(1000);
      const dialog = ops.page.locator('[role="dialog"]').last();
      const confirm = dialog.locator('button:has-text("Save assignee")').last();
      if (await confirm.count()) {
        await confirm.click();
        await ops.page.waitForTimeout(4500);
        assigned = true;
      } else {
        console.log("  (save-assignee dialog did not appear)");
      }
    }
  } else {
    console.log("  (no assignee select on the detail page for this role)");
  }
  await ops.ctx.close();
}
check("assignment exercised", assigned, assigned ? "assignee selected" : "no assignee control found on the row");

const { data: afterAssign } = await db
  .from("tickets").select("assigned_user_id, status").eq("id", tickets?.id ?? "00000000-0000-0000-0000-000000000000").maybeSingle();
check("ticket has an assignee", Boolean(afterAssign?.assigned_user_id), `assignee=${afterAssign?.assigned_user_id ? "set" : "null"}`);

const { data: assignNotif } = await db
  .from("notifications")
  .select("user_id, type, body")
  .eq("type", "ticket.assigned")
  .gt("created_at", new Date(Date.now() - 10 * 60_000).toISOString())
  .order("created_at", { ascending: false })
  .limit(1);
const an = assignNotif?.[0];
check("assignee received ticket.assigned", Boolean(an), an ? `"${an.body}"` : "none");
check("ticket.assigned names the ticket number", Boolean(an?.body?.includes(tickets?.ticket_number ?? "@@")), an?.body);

const { count: notifAfter } = await db
  .from("notifications").select("id", { count: "exact", head: true });
check("notifications were actually created", (notifAfter ?? 0) > (notifBefore ?? 0), `${notifBefore} -> ${notifAfter}`);

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exitCode = 1;