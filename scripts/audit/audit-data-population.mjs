// Read-only. Reports what a signed-in user would actually see on every page:
// which tables hold nothing at all, and which hold too little to look like a
// working product. A page that loads cleanly but renders an empty state is
// invisible to a reachability check, and it is the defect users notice first.
//
// Usage: node scripts/audit/audit-data-population.mjs
//
// Note on counting: `select(..., { count: "exact", head: true })` against a
// table that does not exist returns count `null` AND no error. That reads
// exactly like "we don't know", so every table here is probed with a real
// select first and only counted once it is known to exist.

import { readFileSync } from "node:fs";
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
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Every table the app actually queries, grouped by feature area.
const AREAS = {
  identity: ["profiles","roles","permissions","role_permissions","organization_memberships","membership_roles","organizations"],
  workforce: ["employees","employee_assignments","departments","teams","holidays","client_settings"],
  attendance: ["attendance_records","attendance_correction_requests"],
  leave: ["leave_requests"],
  payroll: ["payroll_periods","payroll_records","payslips","payslip_items","payroll_components","payslip_components"],
  tickets: ["tickets","ticket_messages","ticket_sla_policies"],
  crm: ["crm_leads","crm_deals","crm_proposals","crm_activities","lead_attribution"],
  recruitment: ["job_posts","applicants","job_applications","application_stage_history"],
  billing: ["billing_accounts","invoices","invoice_items","invoice_payments"],
  docs: ["documents"],
  finance: ["cash_advance_requests"],
  approvals: ["approval_workflows","approval_steps","approval_requests","approval_actions"],
  hr: ["nte_cases","nte_responses","disciplinary_actions"],
  notif: ["notifications","notification_preferences","push_subscriptions"],
  cms: ["blog_posts","services","faqs","industries","testimonials","case_studies","site_settings"],
  audit: ["audit_logs"],
};

const missing = [];
const empty = [];
const thin = [];
let total = 0;

for (const [area, tables] of Object.entries(AREAS)) {
  console.log(`\n--- ${area} ---`);
  for (const t of tables) {
    // Do a real select: head:true returns count:null AND no error for a
    // nonexistent table, which reads exactly like "unknown".
    const { error } = await sb.from(t).select("*").limit(1);
    if (error) {
      missing.push(t);
      console.log(`${t.padEnd(32)} MISSING  (${error.message.slice(0, 50)})`);
      continue;
    }
    const { count } = await sb.from(t).select("*", { count: "exact", head: true });
    const n = count ?? 0;
    total += n;
    const flag = n === 0 ? "  <== EMPTY" : n < 3 ? "  <== thin" : "";
    if (n === 0) empty.push(t);
    if (n > 0 && n < 3) thin.push(`${t}=${n}`);
    console.log(`${t.padEnd(32)} ${String(n).padStart(6)}${flag}`);
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`total rows across app tables: ${total}`);
console.log(`MISSING tables (${missing.length}): ${missing.join(", ") || "none"}`);
console.log(`EMPTY tables  (${empty.length}): ${empty.join(", ") || "none"}`);
console.log(`THIN  tables  (<3): ${thin.join(", ") || "none"}`);