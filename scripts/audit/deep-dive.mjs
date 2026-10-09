// Deeper dive on the critical data points.
import { readFileSync } from "node:fs";
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

// Redact after we've captured it.
process.env.SUPABASE_SERVICE_ROLE_KEY = "[redacted]";
process.env.SUPABASE_SECRET_KEY = "[redacted]";
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function show(label, query) {
  console.log("\n--- " + label + " ---");
  try {
    const { data, error } = await query;
    if (error) { console.log("ERR:", error.message); return; }
    if (!data || data.length === 0) { console.log("(empty)"); return; }
    for (const r of data) console.log(JSON.stringify(r));
  } catch (e) { console.log("EXC:", e.message); }
}

// 1. ALL users (auth)
console.log("\n##### AUTH USERS #####");
let page = 1; let totalUsers = 0;
while (true) {
  const r = await sb.auth.admin.listUsers({ page, perPage: 50 });
  if (r.error) { console.log("ERR:", r.error.message); break; }
  const users = r.data?.users || [];
  if (!users.length) break;
  totalUsers += users.length;
  for (const u of users) console.log(`  ${u.email.padEnd(40)} created=${u.created_at} last=${u.last_sign_in_at || 'never'}`);
  if (users.length < 50) break;
  page++;
}
console.log("total auth users:", totalUsers);

// 2. Profiles
await show("PROFILES (first 20)", sb.from("profiles").select("id, first_name, last_name, display_name, status, last_login_at, created_at").order("created_at").limit(20));

// 3. Organizations + memberships
await show("ORGANIZATIONS", sb.from("organizations").select("*"));
await show("MEMBERSHIPS (full)", sb.from("organization_memberships").select("user_id, organization_id, membership_type, status, is_primary, profiles(email, display_name), organization:organizations(name, slug, type)"));

// 4. Membership roles per user
await show("MEMBERSHIP_ROLES", sb.from("membership_roles").select("membership_id, role_id, roles(code, name, scope)"));

// 5. CMS - is it really empty?
await show("SERVICES (cms table)", sb.from("services").select("id, slug, title, status, sort_order"));
await show("INDUSTRIES", sb.from("industries").select("*"));
await show("TESTIMONIALS", sb.from("testimonials").select("*"));
await show("CASE_STUDIES", sb.from("case_studies").select("id, slug, title, status, published_at"));
await show("BLOG_POSTS", sb.from("blog_posts").select("id, slug, title, status, published_at"));
await show("FAQS", sb.from("faqs").select("id, question, status, sort_order"));
await show("SITE_SETTINGS", sb.from("site_settings").select("key, value, description"));

// 6. Employees
await show("EMPLOYEES", sb.from("employees").select("id, employee_number, work_email, job_title, employment_status, profile_id, profiles(email, display_name)"));

// 7. Clients
await show("CLIENT_PROFILES", sb.from("client_profiles").select("*, organization:organizations(name, slug)"));
await show("CLIENT_SETTINGS", sb.from("client_settings").select("*"));

// 8. Tickets
await show("TICKETS", sb.from("tickets").select("id, ticket_number, status, priority, category, subject, client_organization_id, requester_user_id, sla_due_at"));

// 9. CRM
await show("CRM_LEADS", sb.from("crm_leads").select("id, company_name, contact_name, status, source, assigned_sales_user_id, created_at"));
await show("CRM_DEALS", sb.from("crm_deals").select("id, title, stage, estimated_value, currency, company_id, client_organization_id, owner_user_id"));
await show("CRM_PROPOSALS", sb.from("crm_proposals").select("id, title, status, amount, currency, deal_id"));

// 10. ATS
await show("JOB_POSTS", sb.from("job_posts").select("id, title, slug, status, employment_type, location_type, published_at"));
await show("APPLICANTS", sb.from("applicants").select("id, email, first_name, last_name, source, profile_id"));

// 11. Payroll
await show("PAYROLL_PERIODS", sb.from("payroll_periods").select("id, name, start_date, end_date, status"));
await show("PAYROLL_RECORDS (first 5)", sb.from("payroll_records").select("id, payroll_period_id, employee_id, basic_pay, gross_pay, total_deductions, net_pay, status").limit(5));

// 12. Leave
await show("LEAVE_REQUESTS", sb.from("leave_requests").select("id, employee_id, start_at, end_at, requested_minutes, status, leave_types(code, name)"));

// 13. Notifications + audit
await show("NOTIFICATIONS", sb.from("notifications").select("id, user_id, type, title, read_at, created_at").order("created_at").limit(20));
await show("AUDIT_LOGS", sb.from("audit_logs").select("id, actor_user_id, action, entity_type, entity_id, created_at"));

// 14. RLS state - quick check
console.log("\n##### RLS STATE (sampled) #####");
for (const t of ["services", "employees", "tickets", "payroll_records", "crm_leads", "faqs", "site_settings", "audit_logs", "organizations"]) {
  const { data: rls } = await sb.rpc("pg_class", {}).select("*"); // noop placeholder
}

// Use pg_catalog for rls
const rlsRes = await sb.from("pg_class").select("relname, relrowsecurity, relforcerowsecurity").eq("relnamespace", 2200).limit(5);
// That probably won't work via REST. Use raw SQL via rpc instead.
const sql = `
  SELECT c.relname AS table_name,
         c.relrowsecurity AS rls_enabled,
         c.relforcerowsecurity AS rls_forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
  ORDER BY c.relname;
`;
const rlsRows = await sb.rpc("exec_sql", { sql }).then(r => r).catch(() => null);
if (rlsRows?.data) {
  for (const r of rlsRows.data) console.log(`  ${r.table_name.padEnd(36)} rls=${r.rls_enabled} forced=${r.rls_forced}`);
} else {
  console.log("  (RPC exec_sql not available — RLS check skipped)");
}

// 15. Realtime publication
console.log("\n##### REALTIME PUBLICATION #####");
const rtRes = await sb.rpc("exec_sql", { sql: "SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;" }).then(r => r).catch(() => null);
if (rtRes?.data?.length) {
  console.log(`  ${rtRes.data.length} tables in supabase_realtime publication:`);
  for (const r of rtRes.data) console.log(`    - ${r.schemaname}.${r.tablename}`);
} else {
  console.log("  (cannot read realtime publication via REST; needs direct DB or rpc)");
}