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
// It used to sweep leftovers from previous runs at START and nothing at the
// end, so the final run of a session left a ticket and two notifications behind
// — which is what made this script a data generator rather than a test, and it
// contradicted the "cleans up after itself" line above. Cleanup now runs in a
// `finally`, and the last assertion proves this run left nothing behind.
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

const childTables = ["ticket_messages", "ticket_internal_notes", "ticket_status_history"];

/** Delete a ticket and everything hanging off it. Returns nothing; never throws. */
async function purgeTicketIds(ids) {
  if (!ids.length) return;
  await db.from("notifications").delete().in("entity_id", ids);
  for (const t of childTables) await db.from(t).delete().in("ticket_id", ids);
  await db.from("tickets").delete().in("id", ids);
}

/** How many of our own tickets are still in the database right now. */
async function countExerciseTickets() {
  const { count, error } = await db
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .like("subject", "QA ticket exercise%");
  if (error) throw new Error(`count failed: ${error.message}`);
  return count ?? 0;
}

// ---- cleanup from previous runs ----
if (APPLY_CLEANUP) {
  const { data: allStale, error } = await db
    .from("tickets")
    .select("id, subject")
    .like("subject", "QA ticket exercise%");
  if (error) throw new Error(`previous-run sweep failed: ${error.message}`);
  if (allStale?.length) {
    await purgeTicketIds(allStale.map((t) => t.id));
    console.log(`cleanup: removed ${allStale.length} ticket(s) left by previous runs`);
  }
}

const residualBefore = await countExerciseTickets();

const { data: authList } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
const authByEmail = new Map((authList?.users ?? []).map((u) => [u.email, u.id]));
const clientAdminId = authByEmail.get("clientadmin@demo.beepabpo.com");
const opsId = authByEmail.get("operations@demo.beepabpo.com");

const { count: notifBefore } = await db
  .from("notifications").select("id", { count: "exact", head: true });
console.log(`baseline: ${notifBefore} notifications, ${residualBefore} residual exercise tickets\n`);

const browser = await chromium.launch();
let createdTicketId = null;

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

try {
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
  if (tickets?.id) createdTicketId = tickets.id;

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
} finally {
  // ---- end-of-run cleanup: this run's own rows, whatever happened above ----
  //
  // Runs on the success path AND on a throw, so a crashed exercise cannot be
  // the thing that leaves data behind.
  if (!APPLY_CLEANUP) {
    console.log("\nend-of-run cleanup: skipped (--no-cleanup)");
  } else if (createdTicketId) {
    try {
      await purgeTicketIds([createdTicketId]);
      const residualAfter = await countExerciseTickets();
      check(
        "this run left no ticket behind",
        residualAfter === residualBefore,
        `${residualBefore} residual before -> ${residualAfter} after`,
      );
    } catch (err) {
      check("this run left no ticket behind", false, `cleanup threw: ${err.message}`);
    }
  } else {
    console.log("\nend-of-run cleanup: nothing was created by this run");
  }

  await browser.close().catch(() => {});

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}