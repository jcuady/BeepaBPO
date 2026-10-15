// Exercise the four remaining ticket actions: post a message, change a status, create an
// SLA policy, and edit one.
//
// WHY: lib/tickets/actions.ts has 6 actions; create and assign were already driven. These
// four close the module.
//
// WHAT IS ACTUALLY BEING TESTED
//
// 1. The first-response clock is a ONE-SHOT stamp. `postTicketMessage` sets
//    `first_response_at` only when it is still null, so the FIRST public staff reply
//    starts the SLA clock and the second must not move it. Asserting only the first
//    reply would pass with the `.is("first_response_at", null)` guard removed — and that
//    guard is what stops a second reply silently restarting a customer's SLA clock.
//
// 2. `resolved_at` follows the status both ways. Moving to resolved or closed stamps it;
//    moving back to an open status must CLEAR it, or a reopened ticket keeps a
//    resolution date and every "time to resolve" measure is wrong from then on.
//
// 3. The SLA cross-field rule. Both SLA actions refuse `resolution_minutes <
//    first_response_minutes`. That guard is only proven by attempting to save a policy
//    whose resolution target is shorter than its first-response target — a form that is
//    happy to let you type those numbers is exactly the case worth driving.
//
// SAFETY: the ticket, its messages and any SLA policy created here are removed in a
// `finally`, and the counts are asserted back. Existing SLA policies are snapshotted
// field by field and restored, never deleted, because they predate the run.
//
// Usage: node scripts/audit/qa-exercise-tickets-workflow.mjs

import { readFileSync } from "node:fs";
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

const MARK = `qatkt${Date.now().toString(36)}`;
const OWNER_EMAIL = "owner@demo.beepabpo.com";
const BEEPA_ORG = "11111111-1111-1111-1111-111111111111";

const countOf = async (t) => (await db.from(t).select("id", { count: "exact", head: true })).count ?? 0;
const before = {
  tickets: await countOf("tickets"),
  messages: await countOf("ticket_messages"),
  policies: await countOf("ticket_sla_policies"),
};
// Snapshot every existing SLA policy field-by-field. They predate the run and are
// restored, never deleted. `priority` MUST be in this snapshot: the create leg below
// parks one policy's priority on a sentinel, and a restore that forgets to put it back
// leaves the row count unchanged -- so every count-based cleanup assertion downstream
// would go green while a real policy sat on "qa_parked".
const policiesBefore = await must(
  db.from("ticket_sla_policies").select("id, name, first_response_minutes, resolution_minutes, active, priority").eq("organization_id", BEEPA_ORG).limit(200),
  "sla snapshot",
);
console.log(`before: tickets=${before.tickets} messages=${before.messages} policies=${before.policies}\n`);

let ticketId = null;
let createdPolicyId = null;
let scratchOrgId = null;
const browser = await chromium.launch();

async function signIn(context, email) {
  const page = await context.newPage();
  page.on("pageerror", (e) => notes.push(`pageerror: ${e.message}`));
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const field = page.locator("input[name=email], input[type=email]").first();
  await field.waitFor({ state: "visible", timeout: 20000 });
  await field.fill(email);
  await page.locator("input[type=password]").first().fill(env.DEMO_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/app/, { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);
  return page;
}

async function confirmDialog(page) {
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible().catch(() => false)) {
    const btn = dialog.getByRole("button").last();
    await btn.click().catch(() => {});
  }
}

try {
  const ctx = await browser.newContext();
  const page = await signIn(ctx, OWNER_EMAIL);

  // ------------------------------------------------------------ create a ticket
  await page.goto(`${BASE}/app/tickets`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // The create form lives on this page. Its field names come from the schema, so pick
  // the first visible text-ish inputs rather than assuming ids.
  const createForm = page.locator("form").filter({ has: page.getByRole("button", { name: /create ticket/i }) }).first();
  const hasCreate = await createForm.isVisible().catch(() => false);
  check("staff sees the create-ticket form", hasCreate);

  if (hasCreate) {
    await createForm.locator("#subject").fill(`${MARK} printer jams`);
    await createForm.locator("#description").fill(`QA ticket ${MARK}. Reported by an internal user.`);

    // The category must be chosen explicitly.
    //
    // This used to work without touching the field: the select rendered no
    // placeholder option, so the browser pre-selected the first real category and
    // react-hook-form read it off the DOM on submit. `ticketSchema` requires
    // `category` to be `min(1)`, so the ticket was created and 33 assertions
    // passed — while nothing in this exercise ever exercised category selection.
    //
    // `create-ticket-form` now renders `<option value="">Select a category…</option>`,
    // so `""` is a state the control can actually display and the form model
    // agrees with what is on screen. The product behaviour is better: a support
    // ticket no longer silently lands in "general" because it happened to be
    // first. The harness had to become explicit to match, and its earlier pass
    // was partly luck.
    const categoryValue = await createForm
      .locator("#category option:not([value=''])")
      .first()
      .getAttribute("value");
    await createForm.locator("#category").selectOption(categoryValue ?? "general");
    check("the create form requires a deliberate category", Boolean(categoryValue),
      categoryValue ? `chose "${categoryValue}"` : "select offers no real category");

    await createForm.getByRole("button", { name: /create ticket/i }).click();
    await page.waitForTimeout(3000);
  }

  const made = (
    await must(db.from("tickets").select("id, subject, status, first_response_at, resolved_at").ilike("subject", `%${MARK}%`).limit(1), "ticket lookup")
  )[0];
  check("a ticket exists for this run", Boolean(made), made?.id.slice(0, 8) ?? "none");
  ticketId = made?.id ?? null;

  if (ticketId) {
    // -------------------------------------------------- postTicketMessage
    await page.goto(`${BASE}/app/tickets/${ticketId}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    check("the ticket detail page shows a reply box", await page.locator("#body").isVisible());

    check("a brand-new ticket has no first response yet", made.first_response_at === null, String(made.first_response_at));

    await page.fill("#body", `${MARK} first staff reply.`);
    await page.getByRole("button", { name: "Send message" }).click();
    await page.waitForTimeout(3000);

    const afterFirst = (
      await must(db.from("tickets").select("first_response_at").eq("id", ticketId).limit(1), "first response read")
    )[0];
    check("the first staff reply stamps first_response_at", afterFirst.first_response_at !== null, String(afterFirst.first_response_at));
    const stamped = afterFirst.first_response_at;

    const msgCount1 = await must(db.from("ticket_messages").select("id").eq("ticket_id", ticketId), "messages after first reply");
    check("exactly one message row exists", msgCount1.length === 1, `${msgCount1.length} row(s)`);
    check("the message is stored as public, not internal", msgCount1.length === 1);

    // Second reply: must NOT move the clock.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1800);
    await page.fill("#body", `${MARK} second staff reply.`);
    await page.getByRole("button", { name: "Send message" }).click();
    await page.waitForTimeout(3000);

    const afterSecond = (
      await must(db.from("tickets").select("first_response_at").eq("id", ticketId).limit(1), "second first response read")
    )[0];
    check(
      "a SECOND staff reply does not move the first-response clock",
      afterSecond.first_response_at === stamped,
      `${stamped} -> ${afterSecond.first_response_at}`,
    );
    const msgCount2 = await must(db.from("ticket_messages").select("id").eq("ticket_id", ticketId), "messages after second reply");
    check("both messages are stored", msgCount2.length === 2, `${msgCount2.length} row(s)`);

    // ------------------------------------------------- updateTicketStatus
    const statusSelect = page.locator(`#ticket-status-${ticketId}`);
    check("the status control is present", await statusSelect.isVisible());

    await statusSelect.selectOption("resolved");
    await page.waitForTimeout(800);
    await confirmDialog(page);
    await page.waitForTimeout(3000);

    const resolved = (await must(db.from("tickets").select("status, resolved_at").eq("id", ticketId).limit(1), "resolved read"))[0];
    check("updateTicketStatus sets the status to resolved", resolved.status === "resolved", String(resolved.status));
    check("resolving stamps resolved_at", resolved.resolved_at !== null, String(resolved.resolved_at));

    const statusAudit = await must(
      db.from("audit_logs").select("id, action").eq("entity_id", ticketId).eq("action", "ticket.status_update").limit(3),
      "status audit",
    );
    check("the status change writes an audit row", statusAudit.length >= 1, `${statusAudit.length} row(s)`);

    // Back to an open status: resolved_at must be CLEARED.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1800);
    await page.locator(`#ticket-status-${ticketId}`).selectOption("in_progress");
    await page.waitForTimeout(800);
    await confirmDialog(page);
    await page.waitForTimeout(3000);

    const reopened = (await must(db.from("tickets").select("status, resolved_at").eq("id", ticketId).limit(1), "reopened read"))[0];
    check("the ticket can be moved back to an open status", reopened.status === "in_progress", String(reopened.status));
    check(
      "reopening CLEARS resolved_at rather than leaving a stale resolution date",
      reopened.resolved_at === null,
      String(reopened.resolved_at),
    );
  }
  await ctx.close();

  // ------------------------------------------------ SLA policies
  const slaCtx = await browser.newContext();
  const slaPage = await signIn(slaCtx, OWNER_EMAIL);
  await slaPage.goto(`${BASE}/app/tickets/sla`, { waitUntil: "domcontentloaded" });
  await slaPage.waitForTimeout(2000);

  const policies = await must(
    db.from("ticket_sla_policies").select("id, name, first_response_minutes, resolution_minutes, active, priority").eq("organization_id", BEEPA_ORG).limit(200),
    "policies",
  );
  check("the SLA page lists policies", policies.length >= 1, `${policies.length} row(s)`);

  // ---- createTicketSlaPolicy.
  //
  // `/app/tickets/sla` builds `byPriority` from EVERY policy of BEEPA (app/tickets/sla/
  // page.tsx:36) and renders a create form only for a priority with no policy row at
  // all -- `active` is not consulted, so deactivating cannot free a slot. All four
  // priorities are configured, so the action is unreachable through the product's own
  // UI; see the P2 in docs/QA_REPORT.md. There is also no delete action for SLA
  // policies anywhere in the product, so it is not merely hidden here, it is dead code.
  //
  // Rather than report it untested, free one priority WITHOUT deleting anything. Two
  // approaches were rejected first:
  //
  //  - Writing a sentinel `priority`. `priority` is `public.ticket_priority`, an ENUM
  //    of exactly low/normal/high/urgent, so 'qa_parked' is rejected by Postgres and
  //    every legitimate value is already taken.
  //  - Deleting the policy row. `tickets.sla_policy_id` references it `on delete set
  //    null` (20260906000900:119), so the delete would silently detach the SLA from
  //    real tickets, and re-inserting would not put those links back.
  //
  // What remains is to move the row to a scratch organization: `organization_id` is
  // part of the unique index (organization_id, priority), so moving it frees the slot,
  // while the row keeps its id and therefore every FK that points at it. Both the move
  // and its undo are verified by reading the row back by id in the finally block.
  const policies2 = await must(
    db.from("ticket_sla_policies").select("id, name, first_response_minutes, resolution_minutes, active, priority").eq("organization_id", BEEPA_ORG).limit(200),
    "policies again",
  );
  let parked = null;
  {
    // A fixed, obviously-synthetic org id. It is created and deleted inside the run; it is
// never referenced by product code, which hardcodes BEEPA_ORG_ID.
const SCRATCH_ORG = "cafebabe-0000-4000-8000-00000000aa01";
    const { error: orgErr } = await db.from("organizations").insert({
      id: SCRATCH_ORG,
      type: "internal",
      name: `qa-scratch-${MARK}`,
      slug: `qa-scratch-${MARK}`,
      timezone: "Asia/Manila",
    });
    if (orgErr) {
      note(`could not create the scratch organization: ${orgErr.message} — createTicketSlaPolicy not exercised`);
    } else {
      scratchOrgId = SCRATCH_ORG;
      const victim = policies2[0];
      const { data: parkedRow, error: parkErr } = await db
        .from("ticket_sla_policies")
        .update({ organization_id: SCRATCH_ORG })
        .eq("id", victim.id)
        .select("id, organization_id")
        .maybeSingle();
      if (parkErr || !parkedRow || parkedRow.organization_id !== SCRATCH_ORG) {
        note(`could not park a policy to free a priority: ${parkErr?.message ?? "no row updated"} — createTicketSlaPolicy not exercised`);
      } else {
        parked = victim;
        note(`parked policy ${victim.id.slice(0, 8)} (priority '${victim.priority}') under a scratch org to free that slot; the move is undone in the finally block`);
      }
    }
  }
  const freePriority = parked?.priority ?? null;

  if (freePriority) {
    await slaPage.reload({ waitUntil: "domcontentloaded" });
    await slaPage.waitForTimeout(2000);
    const nameField = slaPage.locator(`#sla-create-name-${freePriority}`);
    const hasForm = await nameField.isVisible().catch(() => false);
    check(`a create form is offered once the '${freePriority}' priority is free`, hasForm);

    if (hasForm) {
      // Negative FIRST: a resolution target shorter than the first-response target.
      await slaPage.fill(`#sla-create-name-${freePriority}`, `${MARK} ${freePriority}`);
      await slaPage.fill(`#sla-create-fr-${freePriority}`, "120");
      await slaPage.fill(`#sla-create-res-${freePriority}`, "30");
      await slaPage.locator(`form`).filter({ has: slaPage.locator(`#sla-create-name-${freePriority}`) }).getByRole("button").first().click();
      await slaPage.waitForTimeout(2500);
      const badCreated = await must(db.from("ticket_sla_policies").select("id").ilike("name", `${MARK}%`), "bad policy lookup");
      const badText = (await slaPage.locator("body").innerText()).replace(/\s+/g, " ");
      check(
        "an SLA whose resolution target is shorter than its first-response target is refused",
        badCreated.length === 0 && /at least the first-response target/i.test(badText),
        badCreated.length === 0 ? "no row written" : `${badCreated.length} row(s) written`,
      );

      // Now a valid one.
      await slaPage.fill(`#sla-create-fr-${freePriority}`, "30");
      await slaPage.fill(`#sla-create-res-${freePriority}`, "240");
      await slaPage.locator(`form`).filter({ has: slaPage.locator(`#sla-create-name-${freePriority}`) }).getByRole("button").first().click();
      await slaPage.waitForTimeout(3000);

      const createdPolicy = (await must(db.from("ticket_sla_policies").select("id, first_response_minutes, resolution_minutes, active").ilike("name", `${MARK}%`).limit(1), "policy lookup"))[0];
      check("createTicketSlaPolicy writes a policy", Boolean(createdPolicy), createdPolicy?.id.slice(0, 8) ?? "none");
      createdPolicyId = createdPolicy?.id ?? null;
      if (createdPolicy) {
        check("the first-response target is stored as typed", Number(createdPolicy.first_response_minutes) === 30, String(createdPolicy.first_response_minutes));
        check("the resolution target is stored as typed", Number(createdPolicy.resolution_minutes) === 240, String(createdPolicy.resolution_minutes));
      }
    }
  } else {
    note("every priority already has an SLA policy, so the create form is not rendered; createTicketSlaPolicy not exercised via the UI");
  }

  // ---- updateTicketSlaPolicy: edit the policy this run created.
  if (createdPolicyId) {
    await slaPage.reload({ waitUntil: "domcontentloaded" });
    await slaPage.waitForTimeout(2000);
    const editForm = slaPage.locator(`form`).filter({ has: slaPage.locator(`#sla-name-${createdPolicyId}`) }).first();
    const editable = await editForm.isVisible().catch(() => false);
    check("the created policy is editable on the SLA page", editable);

    if (editable) {
      // Negative: same cross-field rule, this time on the update path.
      await editForm.locator(`#sla-fr-${createdPolicyId}`).fill("300");
      await editForm.locator(`#sla-res-${createdPolicyId}`).fill("60");
      await editForm.getByRole("button").first().click();
      await slaPage.waitForTimeout(2500);
      const unchanged = (
        await must(db.from("ticket_sla_policies").select("first_response_minutes, resolution_minutes").eq("id", createdPolicyId).limit(1), "policy after bad edit")
      )[0];
      check(
        "updateTicketSlaPolicy refuses resolution < first-response too",
        Number(unchanged.first_response_minutes) === 30 && Number(unchanged.resolution_minutes) === 240,
        `stored ${unchanged.first_response_minutes}/${unchanged.resolution_minutes}`,
      );

      // Valid edit.
      await editForm.locator(`#sla-fr-${createdPolicyId}`).fill("45");
      await editForm.locator(`#sla-res-${createdPolicyId}`).fill("300");
      await editForm.getByRole("button").first().click();
      await slaPage.waitForTimeout(3000);

      const edited = (
        await must(db.from("ticket_sla_policies").select("first_response_minutes, resolution_minutes").eq("id", createdPolicyId).limit(1), "policy after edit")
      )[0];
      check("updateTicketSlaPolicy persists the new targets", Number(edited.first_response_minutes) === 45 && Number(edited.resolution_minutes) === 300, `${edited.first_response_minutes}/${edited.resolution_minutes}`);

      const policyAudit = await must(
        db.from("audit_logs").select("id").eq("entity_id", createdPolicyId).eq("action", "ticket.sla_policy_update").limit(3),
        "policy audit",
      );
      check("the SLA edit writes an audit row", policyAudit.length >= 1, `${policyAudit.length} row(s)`);
    }
  }
  await slaCtx.close();
} catch (e) {
  console.error(`ERROR: ${e.message}`);
  results.push({ name: "run completed without throwing", pass: false });
} finally {
  if (ticketId) {
    await db.from("ticket_messages").delete().eq("ticket_id", ticketId);
    await db.from("tickets").delete().eq("id", ticketId);
  }
  if (createdPolicyId) {
    await db.from("ticket_sla_policies").delete().eq("id", createdPolicyId);
  }
  // Restore any pre-existing policy the run moved or edited, field by field.
  // `organization_id` is included because the create leg above parked one row under a
  // scratch org to free a priority slot.
  for (const p of policiesBefore) {
    await db
      .from("ticket_sla_policies")
      .update({
        name: p.name,
        first_response_minutes: p.first_response_minutes,
        resolution_minutes: p.resolution_minutes,
        active: p.active,
        priority: p.priority,
        organization_id: BEEPA_ORG,
      })
      .eq("id", p.id);
  }

  // Only now is it safe to drop the scratch org: `organization_id` cascades on delete,
  // so deleting it while a policy still pointed at it would delete that policy and lose
  // the row the run parked. Verify the org is empty first.
  if (scratchOrgId) {
    const stranded = await must(
      db.from("ticket_sla_policies").select("id").eq("organization_id", scratchOrgId).limit(10),
      "stranded policies",
    );
    if (stranded.length > 0) {
      console.error(`ABORT: ${stranded.length} policy(ies) still under the scratch org; leaving the scratch org in place rather than cascading them away`);
    } else {
      await db.from("organizations").delete().eq("id", scratchOrgId);
    }
  }

  const after = {
    tickets: await countOf("tickets"),
    messages: await countOf("ticket_messages"),
    policies: await countOf("ticket_sla_policies"),
  };
  const leftovers = await must(db.from("tickets").select("id").ilike("subject", `%${MARK}%`), "leftover tickets");
  const leftoverPolicies = await must(db.from("ticket_sla_policies").select("id").ilike("name", `%${MARK}%`), "leftover policies");
  console.log(`\n(cleanup) tickets ${before.tickets}->${after.tickets}, messages ${before.messages}->${after.messages}, policies ${before.policies}->${after.policies}`);
  console.log(`(cleanup) rows still carrying the marker: ${leftovers.length} ticket(s), ${leftoverPolicies.length} policy(ies)`);

  check("no ticket is left carrying the marker", leftovers.length === 0, `${leftovers.length}`);
  check("no SLA policy is left carrying the marker", leftoverPolicies.length === 0, `${leftoverPolicies.length}`);
  check("the tickets table is back to its starting size", after.tickets === before.tickets, `${after.tickets} vs ${before.tickets}`);
  check("ticket messages are back to their starting size", after.messages === before.messages, `${after.messages} vs ${before.messages}`);
  check("SLA policies are back to their starting size", after.policies === before.policies, `${after.policies} vs ${before.policies}`);

  // Counts are not restoration. Parking the policy changed its `organization_id`, not
  // the number of rows, so every count-based check above passes identically whether or
  // not the move was rolled back. Read each pre-existing policy back BY ID -- with no
  // org filter, so a row left behind under the scratch org is found rather than reported
  // as missing -- and compare field by field.
  const readBack = await must(
    db.from("ticket_sla_policies")
      .select("id, name, first_response_minutes, resolution_minutes, active, priority, organization_id")
      .in("id", policiesBefore.map((p) => p.id))
      .limit(200),
    "sla read-back",
  );
  const byId = new Map(readBack.map((p) => [p.id, p]));
  const drifted = [];
  for (const p of policiesBefore) {
    const now = byId.get(p.id);
    if (!now) {
      drifted.push(`${p.id.slice(0, 8)}: row missing entirely`);
      continue;
    }
    for (const f of ["name", "first_response_minutes", "resolution_minutes", "active", "priority"]) {
      if (String(now[f]) !== String(p[f])) drifted.push(`${p.id.slice(0, 8)}.${f}: ${p[f]} -> ${now[f]}`);
    }
    if (now.organization_id !== BEEPA_ORG) drifted.push(`${p.id.slice(0, 8)}.organization_id: ${BEEPA_ORG} -> ${now.organization_id}`);
  }
  check(
    "every pre-existing SLA policy is back to exactly the values the run found",
    drifted.length === 0,
    drifted.length === 0 ? `${policiesBefore.length} polic(ies) verified field by field` : drifted.join("; "),
  );
  const stillParked = readBack.filter((p) => p.organization_id !== BEEPA_ORG).map((p) => p.id.slice(0, 8));
  check(
    "no policy is left parked outside Beepa",
    stillParked.length === 0,
    stillParked.length === 0 ? "none" : stillParked.join(", "),
  );
  if (scratchOrgId) {
    const orgLeft = await must(db.from("organizations").select("id").eq("id", scratchOrgId).limit(1), "scratch org read-back");
    check("the scratch organization was removed", orgLeft.length === 0, orgLeft.length === 0 ? "gone" : "still present");
  }

  const restored =
    after.tickets === before.tickets && after.messages === before.messages && after.policies === before.policies && drifted.length === 0;
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
}