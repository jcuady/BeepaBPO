// Live data presence smoke test.
// Verifies the seeded demo data is present in the live Supabase project.
// This is a *connectivity + data* test, not a logic test. Skips when env is absent.
//
// Run:  pnpm vitest run tests/live-data-smoke.test.ts
import { readFileSync, existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, test, beforeAll, expect } from "vitest";

function loadEnv(file: string) {
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    let v = line.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[line.slice(0, idx).trim()] = v;
  }
  return out;
}

const env = { ...loadEnv(".env.local"), ...loadEnv(".env") };
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const SKIP = !URL || !KEY;

const describeIf = SKIP ? describe.skip : describe;

describeIf("live data smoke (nwvnawgxkzwiercllgmg)", () => {
  let sb: SupabaseClient;
  beforeAll(() => {
    sb = createClient(URL!, KEY!, { auth: { persistSession: false } });
  });

  async function count(table: string) {
    const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(`${table}: ${error.message}`);
    return count ?? 0;
  }

  test("auth users — 13 demo users", async () => {
    const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 50 });
    expect(error).toBeNull();
    expect(data?.users?.length).toBeGreaterThanOrEqual(13);
  });

  test("CMS tables are populated", async () => {
    expect(await count("services")).toBeGreaterThanOrEqual(10);
    expect(await count("industries")).toBeGreaterThanOrEqual(5);
    expect(await count("testimonials")).toBeGreaterThanOrEqual(3);
    expect(await count("case_studies")).toBeGreaterThanOrEqual(3);
    expect(await count("blog_posts")).toBeGreaterThanOrEqual(4);
    expect(await count("faqs")).toBeGreaterThanOrEqual(6);
    expect(await count("site_settings")).toBeGreaterThanOrEqual(3);
  });

  test("HR workforce data is present", async () => {
    expect(await count("employees")).toBeGreaterThanOrEqual(10);
    expect(await count("departments")).toBeGreaterThanOrEqual(3);
    expect(await count("teams")).toBeGreaterThanOrEqual(3);
    expect(await count("payroll_profiles")).toBeGreaterThanOrEqual(8);
    expect(await count("holiday_calendars")).toBeGreaterThanOrEqual(2);
    expect(await count("holidays")).toBeGreaterThanOrEqual(10);
  });

  test("Attendance / leave workflows have data", async () => {
    expect(await count("leave_types")).toBeGreaterThanOrEqual(6);
    expect(await count("leave_balances")).toBeGreaterThanOrEqual(20);
    expect(await count("leave_requests")).toBeGreaterThanOrEqual(1);
    expect(await count("shift_assignments")).toBeGreaterThanOrEqual(5);
  });

  test("Payroll pipeline complete", async () => {
    expect(await count("payroll_periods")).toBeGreaterThanOrEqual(1);
    expect(await count("payroll_records")).toBeGreaterThanOrEqual(5);
    expect(await count("payslips")).toBeGreaterThanOrEqual(1);
    expect(await count("payroll_components")).toBeGreaterThanOrEqual(1);
  });

  test("HR discipline + cash advance workflow data", async () => {
    expect(await count("cash_advance_requests")).toBeGreaterThanOrEqual(1);
    expect(await count("approval_requests")).toBeGreaterThanOrEqual(1);
    expect(await count("nte_cases")).toBeGreaterThanOrEqual(1);
  });

  test("Client portal data is real", async () => {
    expect(await count("client_profiles")).toBeGreaterThanOrEqual(1);
    expect(await count("client_settings")).toBeGreaterThanOrEqual(1);
    expect(await count("client_contacts")).toBeGreaterThanOrEqual(1);
    expect(await count("invoices")).toBeGreaterThanOrEqual(1);
    expect(await count("invoice_items")).toBeGreaterThanOrEqual(1);
    expect(await count("billing_accounts")).toBeGreaterThanOrEqual(1);
  });

  test("Tickets + CRM have data", async () => {
    expect(await count("tickets")).toBeGreaterThanOrEqual(1);
    expect(await count("ticket_messages")).toBeGreaterThanOrEqual(1);
    expect(await count("crm_leads")).toBeGreaterThanOrEqual(2);
    expect(await count("crm_deals")).toBeGreaterThanOrEqual(1);
    expect(await count("crm_proposals")).toBeGreaterThanOrEqual(1);
  });

  test("ATS + performance data", async () => {
    expect(await count("job_posts")).toBeGreaterThanOrEqual(1);
    expect(await count("applicants")).toBeGreaterThanOrEqual(1);
    expect(await count("job_applications")).toBeGreaterThanOrEqual(1);
    expect(await count("application_stage_history")).toBeGreaterThanOrEqual(1);
    expect(await count("interviews")).toBeGreaterThanOrEqual(1);
    expect(await count("assessments")).toBeGreaterThanOrEqual(1);
    expect(await count("performance_cycles")).toBeGreaterThanOrEqual(1);
    expect(await count("performance_kpis")).toBeGreaterThanOrEqual(2);
  });

  test("No duplicate bereavement leave for demo employee", async () => {
    // After dedupe we expect at most 1 bereavement row per (employee, dates).
    const { data } = await sb
      .from("leave_requests")
      .select("id, employee_id, start_at, end_at, leave_types!inner(code)")
      .eq("leave_types.code", "BEREAVEMENT");
    const seen = new Set<string>();
    for (const l of data ?? []) {
      const k = `${l.employee_id}|${l.start_at}|${l.end_at}`;
      expect(seen.has(k), `duplicate bereavement row: ${k}`).toBe(false);
      seen.add(k);
    }
  });

  test("profile.last_login_at synced for demo users", async () => {
    const { data } = await sb.from("profiles").select("id, last_login_at");
    const synced = (data ?? []).filter((p) => p.last_login_at).length;
    expect(synced).toBeGreaterThanOrEqual(10);
  });

  test("Stuck ticket TKT-DEMO-0001 was re-opened with future SLA", async () => {
    const { data } = await sb.from("tickets").select("status, sla_due_at").eq("ticket_number", "TKT-DEMO-0001").maybeSingle();
    expect(data).not.toBeNull();
    expect(data!.status).not.toBe("new");
    expect(new Date(data!.sla_due_at!).getTime()).toBeGreaterThan(Date.now());
  });
});