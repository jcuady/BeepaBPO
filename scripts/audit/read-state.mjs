// Read-only audit. Loads env from .env.local itself.
import { readFileSync } from "node:fs";
import { resolve, join as _join } from "node:path";

function loadEnv(path) {
  let env = {};
  try {
    const txt = readFileSync(path, "utf8");
    for (const line of txt.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx < 0) continue;
      const k = line.slice(0, idx).trim();
      let v = line.slice(idx + 1).trim();
      // strip surrounding quotes
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      env[k] = v;
    }
  } catch {}
  return env;
}

const envFile = process.env.ENV_FILE || ".env.local";
const env = loadEnv(envFile);
for (const [k, v] of Object.entries(env)) {
  if (process.env[k] === undefined) process.env[k] = v;
}

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!URL || !KEY) {
  console.error("Missing env. URL=", !!URL, "KEY=", !!KEY);
  process.exit(1);
}

// Redact in case of logs.
process.env.SUPABASE_SERVICE_ROLE_KEY = "[redacted]";
process.env.SUPABASE_SECRET_KEY = "[redacted]";

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const TABLES = [
  "profiles","organizations","organization_memberships","roles","permissions","membership_roles",
  "notifications","audit_logs","approval_workflows","approval_steps","approval_requests","approval_actions",
  "employees","departments","teams","employee_assignments","holiday_calendars","holidays","shift_assignments",
  "attendance_policies","attendance_events","attendance_records","attendance_correction_requests","overtime_requests",
  "leave_types","leave_balances","leave_requests","documents",
  "nte_cases","nte_responses","disciplinary_actions",
  "cash_advance_requests","cash_advance_deductions",
  "payroll_profiles","payroll_periods","payroll_records","payroll_components","payslips",
  "commission_periods","commission_records",
  "client_profiles","client_contacts","client_settings",
  "ticket_sla_policies","tickets","ticket_messages","ticket_internal_notes","ticket_attachments","ticket_status_history",
  "performance_cycles","performance_reviews","performance_goals","performance_kpis",
  "billing_accounts","invoices","invoice_items","invoice_payments",
  "job_posts","applicants","job_applications","application_stage_history","interviews","assessments","applicant_documents",
  "crm_leads","crm_companies","crm_contacts","crm_deals","crm_activities","crm_proposals","crm_contracts","lead_attribution",
  "services","industries","testimonials","case_studies","blog_posts","faqs","site_settings",
];

async function safeCount(name) {
  try {
    const { count, error } = await sb.from(name).select("*", { count: "exact", head: true });
    return { name, count: error ? `ERR: ${error.message || error.code || JSON.stringify(error)}` : count };
  } catch (e) {
    return { name, count: `EXC: ${e.message}` };
  }
}

const results = [];
for (const t of TABLES) results.push(await safeCount(t));
const w = Math.max(...results.map((r) => r.name.length), 32);
console.log("table".padEnd(w) + " count");
console.log("-".repeat(w) + " -----");
for (const r of results) console.log(r.name.padEnd(w) + " " + r.count);