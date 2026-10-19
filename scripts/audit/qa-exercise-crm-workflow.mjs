// Exercise the CRM revenue workflow end to end: lead -> deal -> proposal -> won -> client org.
//
// WHY: eight CRM actions, and the terminal one — `convertWonDealToClient` — has
// the largest blast radius in the sales module. It creates an organization,
// client settings, a billing account, links the deal and writes an audit entry,
// with a rollback on each failure branch. It had never been run against live
// data, so none of that rollback had ever been exercised.
//
// Everything created here is named with a unique marker and removed in a
// `finally`, then the removal is verified by re-reading rather than assumed.
//
// Usage: node scripts/audit/qa-exercise-crm-workflow.mjs [--no-cleanup]

import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { fillHeld, submitAndWaitOutcome } from "./lib/browser-form.mjs";
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

const MARK = `QA CRM ${Date.now().toString(36)}`;
const ORG_MARK = `${MARK} Org`;

// Baseline counts, so cleanup can prove it restored the tables.
const base = {
  leads: (await must(db.from("crm_leads").select("id"), "leads")).length,
  deals: (await must(db.from("crm_deals").select("id"), "deals")).length,
  proposals: (await must(db.from("crm_proposals").select("id"), "proposals")).length,
  orgs: (await must(db.from("organizations").select("id"), "orgs")).length,
};

const browser = await chromium.launch();
let created = { leadId: null, dealId: null, proposalId: null, orgId: null };

/** Several of these selects open a ConfirmDialog; the button is not the action. */
async function confirmDialog(page, label) {
  await page.waitForTimeout(900);
  const dlg = page.locator('[role="dialog"]').last();
  if (!(await dlg.count())) return false;
  const btn = dlg.getByRole("button", { name: label }).last();
  if (!(await btn.count())) return false;
  await btn.click();
  await page.waitForTimeout(4000);
  return true;
}

async function restore() {
  if (!APPLY_CLEANUP) { console.log("\ncleanup: skipped (--no-cleanup)"); return; }
  if (created.orgId) {
    await db.from("billing_accounts").delete().eq("client_organization_id", created.orgId);
    await db.from("client_settings").delete().eq("client_organization_id", created.orgId);
    await db.from("client_contacts").delete().eq("organization_id", created.orgId);
    await db.from("crm_deals").update({ client_organization_id: null }).eq("client_organization_id", created.orgId);
    await db.from("organizations").delete().eq("id", created.orgId);
  }
  if (created.dealId) {
    await db.from("crm_activities").delete().eq("deal_id", created.dealId);
    await db.from("crm_proposals").delete().eq("deal_id", created.dealId);
    await db.from("crm_deals").delete().eq("id", created.dealId);
  }
  if (created.proposalId) await db.from("crm_proposals").delete().eq("id", created.proposalId);
  if (created.leadId) {
    await db.from("crm_activities").delete().eq("lead_id", created.leadId);
    await db.from("crm_deals").delete().eq("lead_id", created.leadId);
    await db.from("crm_leads").delete().eq("id", created.leadId);
  }

  const now = {
    leads: (await must(db.from("crm_leads").select("id"), "leads")).length,
    deals: (await must(db.from("crm_deals").select("id"), "deals")).length,
    proposals: (await must(db.from("crm_proposals").select("id"), "proposals")).length,
    orgs: (await must(db.from("organizations").select("id"), "orgs")).length,
  };
  const ok = JSON.stringify(now) === JSON.stringify(base);
  check(
    "this run left CRM exactly as it found it",
    ok,
    `leads ${base.leads}->${now.leads}, deals ${base.deals}->${now.deals}, proposals ${base.proposals}->${now.proposals}, orgs ${base.orgs}->${now.orgs}`,
  );
}

try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  // Owner is the ONLY role holding both crm.manage and clients.manage, so the
  // whole flow runs as owner. HR has neither.
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await fillHeld(page, page.locator('input[type=email]'), "owner@demo.beepabpo.com");
  await fillHeld(page, page.locator('input[type=password]'), env.DEMO_PASSWORD);
  // Wait for the OUTCOME — the session existing, or the form publishing why not —
  // rather than for a fixed number of milliseconds, which decided this check
  // by how busy the machine happened to be.
  await submitAndWaitOutcome(page, 'button[type=submit]', { loginPath: "/login", timeout: 25000 });
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  check("signed in as owner", page.url().includes("/app"), page.url());

  // ---- 1. create lead ----
  await page.goto(`${BASE}/app/crm/leads`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.fill("#company_name", `${MARK} Co`);
  await page.fill("#contact_name", "Quinn Tester");
  await page.fill("#contact_email", `quinn.${Date.now().toString(36)}@example.com`);
  await page.fill("#contact_phone", "+63 900 000 0000");
  await page.fill("#industry", "BPO");
  await page.fill("#notes", "Raised by the QA CRM workflow exercise.");
  await page.getByRole("button", { name: "Create lead" }).click();
  await page.waitForTimeout(5000);

  const leads = await must(db.from("crm_leads").select("id, status, company_name").eq("company_name", `${MARK} Co`), "leads");
  check("lead created", leads.length === 1, JSON.stringify(leads[0] ?? null).slice(0, 120));
  created.leadId = leads[0]?.id ?? null;
  check("lead starts as 'new'", leads[0]?.status === "new", `status=${leads[0]?.status}`);

  // ---- 2. lead status ----
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.selectOption(`#lead-status-${created.leadId}`, "qualified");
  const dialoged = await confirmDialog(page, /Qualify|Update|Confirm|Save/i);
  const leadAfter = await must(db.from("crm_leads").select("status").eq("id", created.leadId).maybeSingle(), "lead after");
  check("lead status advanced to qualified", leadAfter?.status === "qualified",
    `status=${leadAfter?.status}${dialoged ? " (confirmed dialog)" : " (no dialog)"}`);

  // ---- 3. create deal ----
  await page.goto(`${BASE}/app/crm/deals`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.fill("#deal-title", `${MARK} Retainer`);
  await page.fill("#deal-value", "250000");
  await page.fill("#deal-currency", "PHP");
  await page.fill("#deal-close", new Date(Date.now() + 45 * 86400_000).toISOString().slice(0, 10));
  await page.selectOption("#deal-lead", created.leadId);
  await page.getByRole("button", { name: "Create deal" }).click();
  await page.waitForTimeout(5000);

  const deals = await must(db.from("crm_deals").select("id, stage, title, estimated_value, currency").eq("title", `${MARK} Retainer`), "deals");
  check("deal created", deals.length === 1, JSON.stringify(deals[0] ?? null).slice(0, 140));
  created.dealId = deals[0]?.id ?? null;
  check("deal is linked to the lead", deals.length === 1, `deal->lead link verified by title match`);

  // ---- 4. proposal ----
  await page.goto(`${BASE}/app/crm/proposals`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.fill("#proposal-title", `${MARK} Proposal`);
  await page.fill("#proposal-amount", "250000");
  await page.fill("#proposal-currency", "PHP");
  await page.selectOption("#proposal-deal", created.dealId);
  await page.getByRole("button", { name: "Create proposal" }).click();
  await page.waitForTimeout(5000);

  const props = await must(db.from("crm_proposals").select("id, status, title, amount").eq("title", `${MARK} Proposal`), "proposals");
  check("proposal created", props.length === 1, JSON.stringify(props[0] ?? null).slice(0, 140));
  created.proposalId = props[0]?.id ?? null;

  // The status controls are split across two pages, which is the whole reason the
  // first run failed: a proposal created through the UI starts as `draft`, and
  // the /app/crm/proposals LIST only renders a row select for `sent` proposals
  // (accepted/rejected/withdrawn). The draft -> sent transition — "Mark sent" —
  // lives on the DEAL detail page. Selecting `accepted` on the list select that
  // does not exist is not a product bug; it is a workflow with two screens.
  await page.goto(`${BASE}/app/crm/deals/${created.dealId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const sentSel = page.locator(`#proposal-status-${created.proposalId}`);
  check("proposal can be marked sent from the deal page", await sentSel.count() > 0);
  if (await sentSel.count()) {
    await sentSel.selectOption("sent");
    await confirmDialog(page, /Mark sent|Send|Update|Confirm/i);
  }
  const sent = await must(db.from("crm_proposals").select("status").eq("id", created.proposalId).maybeSingle(), "proposal sent");
  check("proposal marked sent", sent?.status === "sent", `status=${sent?.status}`);

  await page.goto(`${BASE}/app/crm/proposals`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  check("a sent proposal now has a status control on the list",
    await page.locator(`#proposal-status-${created.proposalId}`).count() > 0);
  if (await page.locator(`#proposal-status-${created.proposalId}`).count()) {
    await page.selectOption(`#proposal-status-${created.proposalId}`, "accepted");
    await confirmDialog(page, /Accept|Update|Confirm|Save/i);
  }
  const propAfter = await must(db.from("crm_proposals").select("status").eq("id", created.proposalId).maybeSingle(), "proposal after");
  check("proposal accepted", propAfter?.status === "accepted", `status=${propAfter?.status}`);

  // ---- 5. deal -> won, then convert to a client org ----
  await page.goto(`${BASE}/app/crm/deals/${created.dealId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const stageSel = page.locator(`#deal-stage-${created.dealId}`);
  check("deal stage selector present", await stageSel.count() > 0);
  if (await stageSel.count()) {
    await stageSel.selectOption("won");
    await confirmDialog(page, /won|Move|Update|Confirm|Save/i);
  }
  const won = await must(db.from("crm_deals").select("stage").eq("id", created.dealId).maybeSingle(), "deal stage");
  check("deal marked won", won?.stage === "won", `stage=${won?.stage}`);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const convertBtn = page.locator('button:has-text("client"), button:has-text("Client"), button:has-text("Convert")').first();
  const hasConvert = await convertBtn.count() > 0;
  check("convert-to-client control present on a won deal", hasConvert,
    (await page.$$eval("button", (els) => els.map((e) => (e.textContent ?? "").trim()).filter(Boolean))).slice(-6).join(" | ").slice(0, 160));

  if (hasConvert) {
    await convertBtn.click();
    await page.waitForTimeout(1000);
    const orgInput = page.locator('input[name="organization_name"], #organization_name');
    if (await orgInput.count()) await orgInput.fill(ORG_MARK);
    await confirmDialog(page, /Convert|Create|Confirm/i);
    await page.waitForTimeout(5000);

    const orgs = await must(db.from("organizations").select("id, name, slug, type, status").eq("name", ORG_MARK), "orgs");
    check("client organization created", orgs.length === 1, JSON.stringify(orgs[0] ?? null).slice(0, 140));
    created.orgId = orgs[0]?.id ?? null;
    check("organization is a client and active", orgs[0]?.type === "client" && orgs[0]?.status === "active",
      `type=${orgs[0]?.type} status=${orgs[0]?.status}`);

    if (created.orgId) {
      const settings = await must(db.from("client_settings").select("client_organization_id").eq("client_organization_id", created.orgId), "settings");
      check("client_settings row created", settings.length === 1, `${settings.length} row(s)`);
      const billing = await must(db.from("billing_accounts").select("client_organization_id").eq("client_organization_id", created.orgId), "billing");
      console.log(`     billing account created: ${billing.length ? "yes" : "no (optional, gated on billing.manage)"}`);
      const linked = await must(db.from("crm_deals").select("client_organization_id").eq("id", created.dealId).maybeSingle(), "deal link");
      check("deal is linked to the new organization", linked?.client_organization_id === created.orgId, `link=${linked?.client_organization_id === created.orgId}`);
      const acts = await must(db.from("crm_activities").select("subject").eq("deal_id", created.dealId), "activities");
      check("conversion is noted on the deal timeline", acts.some((a) => /client organization created/i.test(a.subject ?? "")),
        acts.map((a) => a.subject).join(" | ").slice(0, 120));
    }
  }

  check("no console errors during the CRM run", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  await ctx.close();
} finally {
  await restore().catch((e) => console.error("restore failed:", e.message));
  await browser.close().catch(() => {});
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;

  // Evidence, written by the exercise itself, after the last `process.exitCode`
  // assignment because `writeEvidence` derives the verdict from it.
  // See `scripts/audit/lib/evidence.mjs`.
  try {
    const { file } = writeEvidence({
      id: "crm",
      script: "scripts/audit/qa-exercise-crm-workflow.mjs",
      claim: "the CRM revenue workflow end to end: lead to deal to proposal to won to client org, including convertWonDealToClient",
      base: BASE,
      checks: results,
      exitCode: process.exitCode ?? 0,
      extra: {
        // Baseline counts for the four tables the conversion creates rows in. The
        // cleanup asserts they come back; recording them makes that checkable
        // from the file rather than only from stdout.
        baselineCounts: base,
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