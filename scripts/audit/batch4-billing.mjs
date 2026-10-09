// Batch 4: Payslip + billing pipeline.
// - billing_accounts for CloudPeak
// - invoice_items for the existing INV-CP-2026-09 invoice (2 line items matching the 2 assigned employees)
// - invoice_payments (1 partial payment)
// - Run calculate_payroll_record RPC on all draft payroll_records so numbers are real
// - Generate payslips rows + a real-looking PDF stub path for finalized records
// All idempotent.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BEEPA_ORG_ID = "11111111-1111-1111-1111-111111111111";
const CLOUDPEAK_ORG_ID = "1a91499c-56b5-4d60-ae9d-3835545b6ed5";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx < 0) continue;
  let v = line.slice(idx + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, idx).trim()] = v;
}
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_SECRET_KEY = "[redacted]";
process.env.SUPABASE_SERVICE_ROLE_KEY = "[redacted]";
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

async function main() {
  console.log("=== BATCH 4 — Payslip + billing pipeline ===\n");

  // 1) billing_accounts for CloudPeak
  console.log("--- billing_accounts ---");
  const { data: ba, error: baErr } = await sb.from("billing_accounts").upsert(
    {
      client_organization_id: CLOUDPEAK_ORG_ID,
      currency: "USD",
      payment_terms_days: 30,
      billing_email: "billing@cloudpeak.example",
      status: "active",
    },
    { onConflict: "client_organization_id" },
  ).select("id, currency, status");
  if (baErr) console.error("  [FAIL] billing_accounts:", baErr.message);
  else console.log("  [OK]   billing_accounts upserted for CloudPeak:", ba?.[0]?.id?.slice(0, 8));

  // 2) invoice_items for INV-CP-2026-09
  console.log("\n--- invoice_items ---");
  const { data: invoice } = await sb.from("invoices").select("id, invoice_number").eq("invoice_number", "INV-CP-2026-09").maybeSingle();
  if (!invoice) { console.error("  [FAIL] invoice INV-CP-2026-09 not found"); return; }
  // Find CloudPeak-assigned employees
  const { data: assignments } = await sb.from("employee_assignments").select("id, employee_id, role_title").eq("client_organization_id", CLOUDPEAK_ORG_ID).eq("status", "active");
  const items = [];
  for (const a of assignments ?? []) {
    items.push({
      invoice_id: invoice.id,
      employee_assignment_id: a.id,
      description: `Monthly managed support — ${a.role_title}`,
      quantity: 0.5, // half-month for period 9/1-9/15
      unit_rate: 6240,
      amount: 3120,
    });
  }
  // Make sure the invoice total (12480) is consistent with items we add.
  // Items currently sum to 6240; add a 'platform fee' item for the remaining 6240.
  items.push({
    invoice_id: invoice.id,
    description: "Platform & payroll admin fee — half month",
    quantity: 0.5,
    unit_rate: 12480,
    amount: 6240,
  });
  // Replace existing items first to keep totals consistent
  await sb.from("invoice_items").delete().eq("invoice_id", invoice.id);
  const { error: itemsErr, count } = await sb.from("invoice_items").upsert(items, { onConflict: "id", count: "exact" });
  if (itemsErr) console.error("  [FAIL] invoice_items:", itemsErr.message);
  else console.log(`  [OK]   invoice_items upserted: ${count ?? items.length}`);

  // 3) invoice_payments (1 partial)
  console.log("\n--- invoice_payments ---");
  const { data: existingPay } = await sb.from("invoice_payments").select("id").eq("invoice_id", invoice.id);
  if (!existingPay?.length) {
    const { error: payErr } = await sb.from("invoice_payments").insert({
      invoice_id: invoice.id,
      amount: 6240,
      paid_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      reference: "ACH-2026-09-00417",
      method: "ach",
    }).select("id");
    if (payErr) console.error("  [FAIL] invoice_payments:", payErr.message);
    else console.log("  [OK]   invoice_payments inserted (50% partial payment)");
    // Update invoice status to 'partially_paid'
    await sb.from("invoices").update({ status: "partially_paid" }).eq("id", invoice.id);
    console.log("  [OK]   invoice status -> partially_paid");
  } else {
    console.log("  [skip] invoice_payments already exist");
  }

  // 4) Re-run calculate_payroll_record on all draft records
  console.log("\n--- calculate_payroll_record (RPC) ---");
  const { data: draftRecords } = await sb.from("payroll_records").select("id, payroll_period_id, employee_id, status").eq("status", "draft");
  let calcCount = 0;
  for (const r of draftRecords ?? []) {
    const { error } = await sb.rpc("calculate_payroll_record", { p_payroll_record_id: r.id });
    if (error) { console.error(`  [FAIL] ${r.id.slice(0,8)}: ${error.message}`); continue; }
    calcCount++;
  }
  console.log(`  [OK]   calculated ${calcCount} draft payroll_records via RPC`);

  // 5) payslips — create payslip rows for finalized payroll records
  console.log("\n--- payslips ---");
  const { data: finalized } = await sb.from("payroll_records").select("id, payroll_period_id, employee_id, net_pay").in("status", ["calculated", "finalized", "approved"]);
  let payslipCount = 0;
  for (const r of finalized ?? []) {
    const existing = await sb.from("payslips").select("id").eq("payroll_record_id", r.id);
    if (existing.data?.length) continue;
    const { error } = await sb.from("payslips").insert({
      payroll_record_id: r.id,
      employee_id: r.employee_id,
      generated_at: new Date().toISOString(),
      pdf_path: `payslips/${r.employee_id}/${r.payroll_period_id.slice(0, 8)}-v1.pdf`,
      version: 1,
    }).select("id");
    if (!error) payslipCount++;
  }
  console.log(`  [OK]   payslips created: ${payslipCount}`);

  // 6) payroll_components for the finalized record so the payslip detail page has rows
  console.log("\n--- payroll_components ---");
  const { data: finalizedForComps } = await sb.from("payroll_records").select("id, employee_id, basic_pay, overtime_pay, allowances").eq("status", "finalized").limit(5);
  let compsCount = 0;
  for (const r of finalizedForComps ?? []) {
    const existing = await sb.from("payroll_components").select("id").eq("payroll_record_id", r.id);
    if (existing.data?.length) continue;
    const rows = [
      { payroll_record_id: r.id, type: "earning", code: "BASIC", label: "Basic salary", quantity: 1, rate: r.basic_pay, amount: r.basic_pay, source_type: "payroll_period", source_id: null },
      { payroll_record_id: r.id, type: "earning", code: "ALLOW", label: "Allowances", quantity: 1, rate: r.allowances, amount: r.allowances, source_type: "manual", source_id: null },
    ].filter((row) => row.amount > 0);
    if (rows.length) {
      const { error } = await sb.from("payroll_components").insert(rows);
      if (!error) compsCount++;
    }
  }
  console.log(`  [OK]   payroll_components inserted: ${compsCount}`);

  console.log("\n=== BATCH 4 DONE ===");
}

main().catch((e) => { console.error("FATAL", e.message); process.exit(1); });