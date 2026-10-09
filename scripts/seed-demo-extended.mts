// Extended seed: runs AFTER `pnpm seed:demo` to add the tables that the original
// script did not cover. Idempotent — safe to re-run.
//
//   pnpm tsx scripts/seed-demo-extended.mts
//   (or: node --experimental-strip-types scripts/seed-demo-extended.mts)
//
// Adds:
//   - departments + teams (with employee assignments)
//   - holiday_calendars (PH + US) + 18 holidays
//   - payroll_profiles for all internal employees
//   - client_contacts for CloudPeak
//   - billing_accounts + invoice_items + invoice_payments
//   - performance_cycles (2026 Q2 + Q3) + attach orphan KPI + add CSAT/AHT/ATTENDANCE
//   - application_stage_history + interview + assessment for the seeded applicant
//   - cash_advance_requests (1 demo pending) + approval_request
//   - nte_cases (1 issued, awaiting response)
//   - audit_logs (3 representative entries)
//   - profile.last_login_at sync from auth.users
//   - mark stale notifications read
//   - assign unassigned CRM leads
//   - re-open stuck ticket
//   - finalize draft payroll records + create payslips + components
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BEEPA_ORG_ID = "11111111-1111-1111-1111-111111111111";
const CLOUDPEAK_SLUG = "cloudpeak";

function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    const file = resolve(process.cwd(), name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const raw = trimmed.slice(eq + 1).trim();
      const value = raw.replace(/^(['"])(.*)\1$/, "$2");
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or service key");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function upsert(
  sb: SupabaseClient,
  table: string,
  rows: any[],
  conflict: string,
  label: string,
) {
  if (!rows.length) return;
  const { error } = await sb.from(table).upsert(rows, { onConflict: conflict });
  if (error) console.error(`  [FAIL] ${label}: ${error.message}`);
  else console.log(`  [OK]   ${label.padEnd(38)} +${rows.length} rows`);
}

async function getCloudPeakId(sb: SupabaseClient) {
  const { data } = await sb.from("organizations").select("id").eq("slug", CLOUDPEAK_SLUG).maybeSingle();
  return data?.id ?? null;
}

async function main() {
  loadEnvFiles();
  const sb = admin();
  const cloudPeakId = await getCloudPeakId(sb);
  if (!cloudPeakId) { console.error("CloudPeak org missing. Run `pnpm seed:demo` first."); process.exit(1); }

  console.log("=== EXTENDED SEED — additional demo data ===\n");

  // 1) departments
  await upsert(sb, "departments", [
    { organization_id: BEEPA_ORG_ID, name: "Customer Operations", code: "CX", status: "active" },
    { organization_id: BEEPA_ORG_ID, name: "Marketing", code: "MKT", status: "active" },
    { organization_id: BEEPA_ORG_ID, name: "People Operations", code: "PPL", status: "active" },
    { organization_id: BEEPA_ORG_ID, name: "Finance & Payroll", code: "FIN", status: "active" },
    { organization_id: BEEPA_ORG_ID, name: "Engineering", code: "ENG", status: "active" },
  ], "organization_id,code", "departments");

  const { data: depts } = await sb.from("departments").select("id, code").eq("organization_id", BEEPA_ORG_ID);
  const deptByCode = Object.fromEntries((depts ?? []).map((d) => [d.code, d.id]));

  // 2) teams
  await upsert(sb, "teams", [
    { organization_id: BEEPA_ORG_ID, department_id: deptByCode["CX"], name: "Voice Support" },
    { organization_id: BEEPA_ORG_ID, department_id: deptByCode["CX"], name: "Back Office" },
    { organization_id: BEEPA_ORG_ID, department_id: deptByCode["MKT"], name: "Content & Campaigns" },
    { organization_id: BEEPA_ORG_ID, department_id: deptByCode["FIN"], name: "Payroll Operations" },
    { organization_id: BEEPA_ORG_ID, department_id: deptByCode["ENG"], name: "Platform" },
  ], "id", "teams");

  const { data: teams } = await sb.from("teams").select("id, name").eq("organization_id", BEEPA_ORG_ID);
  const teamByName = Object.fromEntries((teams ?? []).map((t) => [t.name, t.id]));

  // 3) employee department + team
  const { data: emps } = await sb.from("employees").select("id, work_email, profile_id").eq("organization_id", BEEPA_ORG_ID);
  let empUpdated = 0;
  for (const e of emps ?? []) {
    const email = e.work_email ?? "";
    const patch: any = {};
    if (email.startsWith("employee") || email.startsWith("teamlead")) {
      patch.department_id = deptByCode["CX"]; patch.team_id = teamByName["Voice Support"];
    } else if (email.startsWith("marketing")) {
      patch.department_id = deptByCode["MKT"]; patch.team_id = teamByName["Content & Campaigns"];
    } else if (email.startsWith("hr")) { patch.department_id = deptByCode["PPL"]; }
    else if (email.startsWith("finance")) {
      patch.department_id = deptByCode["FIN"]; patch.team_id = teamByName["Payroll Operations"];
    } else if (email.startsWith("operations")) {
      patch.department_id = deptByCode["CX"]; patch.team_id = teamByName["Voice Support"];
    } else if (email.startsWith("sales") || email.startsWith("recruiter")) { patch.department_id = deptByCode["CX"]; }
    else { patch.department_id = deptByCode["ENG"]; patch.team_id = teamByName["Platform"]; }
    const { error } = await sb.from("employees").update(patch).eq("id", e.id);
    if (!error) empUpdated++;
  }
  console.log(`  [OK]   ${"employees (dept + team)".padEnd(38)} ${empUpdated} updated`);

  // 4) holiday_calendars + holidays
  await upsert(sb, "holiday_calendars", [
    { organization_id: BEEPA_ORG_ID, name: "Philippines 2026", timezone: "Asia/Manila", active: true },
    { organization_id: BEEPA_ORG_ID, client_organization_id: cloudPeakId, name: "US Federal 2026", timezone: "America/New_York", active: true },
  ], "id", "holiday_calendars");
  const { data: calendars } = await sb.from("holiday_calendars").select("id, name").eq("organization_id", BEEPA_ORG_ID);
  const calByName = Object.fromEntries((calendars ?? []).map((c) => [c.name, c.id]));
  await upsert(sb, "holidays", [
    { holiday_calendar_id: calByName["Philippines 2026"], name: "New Year's Day", holiday_date: "2026-01-01", is_recurring: true },
    { holiday_calendar_id: calByName["Philippines 2026"], name: "Maundy Thursday", holiday_date: "2026-04-02", is_recurring: false },
    { holiday_calendar_id: calByName["Philippines 2026"], name: "Good Friday", holiday_date: "2026-04-03", is_recurring: false },
    { holiday_calendar_id: calByName["Philippines 2026"], name: "Day of Valor", holiday_date: "2026-04-09", is_recurring: true },
    { holiday_calendar_id: calByName["Philippines 2026"], name: "Labor Day", holiday_date: "2026-05-01", is_recurring: true },
    { holiday_calendar_id: calByName["Philippines 2026"], name: "Independence Day", holiday_date: "2026-06-12", is_recurring: true },
    { holiday_calendar_id: calByName["Philippines 2026"], name: "Eid'l Adha", holiday_date: "2026-05-27", is_recurring: false },
    { holiday_calendar_id: calByName["Philippines 2026"], name: "Ninoy Aquino Day", holiday_date: "2026-08-21", is_recurring: true },
    { holiday_calendar_id: calByName["Philippines 2026"], name: "National Heroes Day", holiday_date: "2026-08-31", is_recurring: true },
    { holiday_calendar_id: calByName["Philippines 2026"], name: "Bonifacio Day", holiday_date: "2026-11-30", is_recurring: true },
    { holiday_calendar_id: calByName["Philippines 2026"], name: "Christmas Day", holiday_date: "2026-12-25", is_recurring: true },
    { holiday_calendar_id: calByName["Philippines 2026"], name: "Rizal Day", holiday_date: "2026-12-30", is_recurring: true },
    { holiday_calendar_id: calByName["US Federal 2026"], name: "New Year's Day", holiday_date: "2026-01-01", is_recurring: true },
    { holiday_calendar_id: calByName["US Federal 2026"], name: "Memorial Day", holiday_date: "2026-05-25", is_recurring: false },
    { holiday_calendar_id: calByName["US Federal 2026"], name: "Independence Day", holiday_date: "2026-07-03", is_recurring: false },
    { holiday_calendar_id: calByName["US Federal 2026"], name: "Labor Day", holiday_date: "2026-09-07", is_recurring: false },
    { holiday_calendar_id: calByName["US Federal 2026"], name: "Thanksgiving", holiday_date: "2026-11-26", is_recurring: false },
    { holiday_calendar_id: calByName["US Federal 2026"], name: "Christmas Day", holiday_date: "2026-12-25", is_recurring: true },
  ], "holiday_calendar_id,holiday_date", "holidays");

  // 5) payroll_profiles
  const roleSalary: Record<string, number> = {
    employee: 25000, team_lead: 35000, hr: 45000, recruiter: 40000,
    sales: 45000, marketing: 45000, operations: 55000, finance: 55000,
    super_admin: 85000, owner: 120000,
  };
  const profRows = (emps ?? []).map((e) => {
    const role = Object.keys(roleSalary).find((r) => (e.work_email ?? "").startsWith(r));
    return {
      employee_id: e.id,
      pay_frequency: "semi_monthly",
      compensation_type: "monthly_salary",
      base_salary: roleSalary[role ?? "employee"] ?? 25000,
      currency: "PHP",
      overtime_multiplier: 1.25,
      active: true,
    };
  });
  await upsert(sb, "payroll_profiles", profRows, "employee_id", "payroll_profiles");

  // 6) client_contacts
  await upsert(sb, "client_contacts", [
    { client_organization_id: cloudPeakId, name: "Ana Reyes",  email: "ana@cloudpeak.example",   phone: "+1 (415) 555-0117", job_title: "VP Customer Experience", is_primary: true },
    { client_organization_id: cloudPeakId, name: "Marcus Lin", email: "marcus@cloudpeak.example", phone: "+1 (415) 555-0182", job_title: "Head of Operations",     is_primary: false },
  ], "id", "client_contacts");

  // 7) billing_accounts
  await upsert(sb, "billing_accounts", [
    { client_organization_id: cloudPeakId, currency: "USD", payment_terms_days: 30, billing_email: "billing@cloudpeak.example", status: "active" },
  ], "client_organization_id", "billing_accounts");

  // 8) invoice_items for INV-CP-2026-09
  const { data: inv } = await sb.from("invoices").select("id").eq("invoice_number", "INV-CP-2026-09").maybeSingle();
  if (inv) {
    const { data: assignments } = await sb.from("employee_assignments").select("id, role_title").eq("client_organization_id", cloudPeakId).eq("status", "active");
    const items = [
      ...(assignments ?? []).map((a) => ({
        invoice_id: inv.id,
        employee_assignment_id: a.id,
        description: `Monthly managed support — ${a.role_title}`,
        quantity: 0.5, unit_rate: 6240, amount: 3120,
      })),
      { invoice_id: inv.id, description: "Platform & payroll admin fee — half month", quantity: 0.5, unit_rate: 12480, amount: 6240 },
    ];
    await sb.from("invoice_items").delete().eq("invoice_id", inv.id);
    await upsert(sb, "invoice_items", items, "id", "invoice_items");

    // invoice_payments (1 partial)
    const { data: existingPay } = await sb.from("invoice_payments").select("id").eq("invoice_id", inv.id);
    if (!existingPay?.length) {
      await sb.from("invoice_payments").insert({
        invoice_id: inv.id, amount: 6240, paid_at: new Date(Date.now() - 5 * 86400000).toISOString(), reference: "ACH-2026-09-00417", method: "ach",
      });
      await sb.from("invoices").update({ status: "partially_paid" }).eq("id", inv.id);
      console.log("  [OK]   invoice_payments + invoice -> partially_paid");
    } else {
      console.log("  [skip] invoice_payments already present");
    }
  } else {
    console.log("  [skip] invoice INV-CP-2026-09 not found (run seed:demo first)");
  }

  // 9) performance_cycles
  await upsert(sb, "performance_cycles", [
    { organization_id: BEEPA_ORG_ID, name: "2026 Q3 (Jul-Sep)", start_date: "2026-07-01", end_date: "2026-09-30", status: "active" },
    { organization_id: BEEPA_ORG_ID, name: "2026 Q2 (Apr-Jun)", start_date: "2026-04-01", end_date: "2026-06-30", status: "closed" },
  ], "id", "performance_cycles");
  const { data: cycles } = await sb.from("performance_cycles").select("id, name").eq("organization_id", BEEPA_ORG_ID);
  const q3 = (cycles ?? []).find((c) => c.name.includes("Q3"));

  // 10) attach orphan KPIs + add CSAT/AHT/ATTENDANCE for demo employee
  const { data: orphans } = await sb.from("performance_kpis").select("id").is("cycle_id", null);
  let attached = 0;
  for (const k of orphans ?? []) {
    const { error } = await sb.from("performance_kpis").update({ cycle_id: q3?.id }).eq("id", k.id);
    if (!error) attached++;
  }
  console.log(`  [OK]   ${"performance_kpis (attached orphan)".padEnd(38)} ${attached}`);
  const demoEmp = (emps ?? []).find((e) => (e.work_email ?? "").startsWith("employee@"));
  if (demoEmp) {
    const { data: existing } = await sb.from("performance_kpis").select("code").eq("employee_id", demoEmp.id);
    const codes = (existing ?? []).map((k) => k.code);
    const additions = [];
    if (!codes.includes("CSAT"))        additions.push({ employee_id: demoEmp.id, cycle_id: q3?.id, code: "CSAT", label: "CSAT", target_value: 4.5, actual_value: 4.7, visibility: "client_visible" });
    if (!codes.includes("AHT"))         additions.push({ employee_id: demoEmp.id, cycle_id: q3?.id, code: "AHT", label: "Average Handle Time (min)", target_value: 7, actual_value: 6.8, visibility: "client_visible" });
    if (!codes.includes("ATTENDANCE_PCT")) additions.push({ employee_id: demoEmp.id, cycle_id: q3?.id, code: "ATTENDANCE_PCT", label: "Attendance %", target_value: 95, actual_value: 98.2, visibility: "employee_visible" });
    if (additions.length) await upsert(sb, "performance_kpis", additions, "id", "performance_kpis (new for demo employee)");
  }

  // 11) ATS history for the seeded applicant
  const { data: apps } = await sb.from("job_applications").select("id");
  const recruiter = (await sb.from("profiles").select("id").ilike("display_name", "%Recruiter%").maybeSingle())?.data?.id;
  const applicantProfile = (await sb.from("profiles").select("id").ilike("display_name", "%Applicant%").maybeSingle())?.data?.id;
  for (const a of apps ?? []) {
    const existing = await sb.from("application_stage_history").select("id").eq("job_application_id", a.id);
    if (!existing.data?.length) {
      await sb.from("application_stage_history").insert([
        { job_application_id: a.id, from_stage: null, to_stage: "applied", changed_by: applicantProfile, notes: "Submitted via /careers", created_at: new Date(Date.now() - 9 * 86400000).toISOString() },
        { job_application_id: a.id, from_stage: "applied", to_stage: "screening", changed_by: recruiter, notes: "Resume passed initial review", created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
        { job_application_id: a.id, from_stage: "screening", to_stage: "initial_interview", changed_by: recruiter, notes: "Phone screen scheduled", created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
      ]);
    }
    const intv = await sb.from("interviews").select("id").eq("job_application_id", a.id);
    if (!intv.data?.length) {
      await sb.from("interviews").insert({
        job_application_id: a.id, interviewer_user_id: recruiter,
        scheduled_at: new Date(Date.now() + 2 * 86400000).toISOString(),
        duration_minutes: 45, location: "Zoom", meeting_url: "https://meet.example/beepa-intv-" + a.id.slice(0, 6),
        status: "scheduled", notes: "Run role-play on customer empathy + escalation.",
      });
    }
    const ass = await sb.from("assessments").select("id").eq("job_application_id", a.id);
    if (!ass.data?.length) {
      await sb.from("assessments").insert({
        job_application_id: a.id, title: "Written customer response scenario", assessment_type: "written",
        score: 85, max_score: 100, completed_at: new Date(Date.now() - 1 * 86400000).toISOString(),
        notes: "Demo: applicant wrote a clear, empathetic refund response.",
      });
    }
  }
  console.log("  [OK]   ATS stage_history + interview + assessment ensured");

  // 12) cash_advance_requests
  if (demoEmp) {
    const existing = await sb.from("cash_advance_requests").select("id").eq("employee_id", demoEmp.id).eq("reason", "Demo: emergency medical expense");
    if (!existing.data?.length) {
      const ins = await sb.from("cash_advance_requests").insert({
        employee_id: demoEmp.id, requested_amount: 8000,
        reason: "Demo: emergency medical expense for a family member.",
        requested_repayment_periods: 4, status: "pending",
      }).select("id").single();
      if (ins.data) {
        const wf = await sb.from("approval_workflows").select("id").eq("code", "cash_advance").eq("active", true).maybeSingle();
        if (wf.data) {
          const step = await sb.from("approval_steps").select("step_order").eq("workflow_id", wf.data.id).order("step_order").limit(1);
          await sb.from("approval_requests").insert({
            workflow_id: wf.data.id, entity_type: "cash_advance", entity_id: ins.data.id,
            requester_user_id: demoEmp.profile_id, current_step: step.data?.[0]?.step_order ?? 1,
            status: "pending", payload: { requested_amount: 8000, reason: "Demo: emergency medical expense for a family member." },
          });
        }
        console.log("  [OK]   cash_advance_requests + approval_request seeded");
      }
    } else {
      console.log("  [skip] cash_advance_requests already present");
    }
  }

  // 13) nte_cases
  if (demoEmp) {
    const existing = await sb.from("nte_cases").select("id").eq("employee_id", demoEmp.id).eq("incident_type", "attendance_pattern");
    if (!existing.data?.length) {
      const caseNum = `NTE-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const hr = (await sb.from("profiles").select("id").ilike("display_name", "%HR%").maybeSingle())?.data?.id;
      await sb.from("nte_cases").insert({
        employee_id: demoEmp.id, case_number: caseNum,
        incident_date: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
        incident_type: "attendance_pattern",
        subject: "Three consecutive unauthorized late clock-ins",
        description: "Employee clocked in late by 30+ minutes on three consecutive scheduled shifts without prior notice or approval.",
        issued_by: hr, issued_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        response_due_at: new Date(Date.now() + 5 * 86400000).toISOString(),
        status: "awaiting_response", evidence_urls: [],
      });
      console.log("  [OK]   nte_cases seeded:", caseNum);
    } else {
      console.log("  [skip] nte_cases already present");
    }
  }

  // 14) audit_logs (3 representative)
  const { data: authUsers } = await sb.auth.admin.listUsers({ page: 1, perPage: 50 });
  const userByEmail = Object.fromEntries((authUsers?.users ?? []).map((u) => [u.email, u.id]));
  const auditEntries = [
    { actor_user_id: userByEmail["hr@demo.beepabpo.com"], action: "leave.approve", entity_type: "leave_request", organization_id: BEEPA_ORG_ID, after_data: { step: "hr", decision: "approved" } },
    { actor_user_id: userByEmail["owner@demo.beepabpo.com"], action: "client.invite", entity_type: "client_organization", entity_id: cloudPeakId, organization_id: cloudPeakId, after_data: { invite_email: "clientadmin@demo.beepabpo.com" } },
    { actor_user_id: userByEmail["recruiter@demo.beepabpo.com"], action: "applicant.stage_change", entity_type: "job_application", organization_id: BEEPA_ORG_ID, after_data: { from: "applied", to: "screening" } },
  ];
  for (const e of auditEntries) {
    if (!e.actor_user_id) continue;
    await sb.from("audit_logs").insert({ ...e, user_agent: "seed-demo-extended" });
  }
  console.log("  [OK]   audit_logs seeded (3 entries)");

  // 15) profile.last_login_at sync
  let synced = 0;
  for (const u of authUsers?.users ?? []) {
    if (!u.last_sign_in_at) continue;
    const { error } = await sb.from("profiles").update({ last_login_at: u.last_sign_in_at }).eq("id", u.id);
    if (!error) synced++;
  }
  console.log(`  [OK]   profiles.last_login_at synced: ${synced}`);

  // 16) mark stale notifications read
  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString();
  const staleUsers = [userByEmail["hr@demo.beepabpo.com"], userByEmail["teamlead@demo.beepabpo.com"]].filter(Boolean);
  if (staleUsers.length) {
    const { data, error } = await sb.from("notifications").update({ read_at: new Date().toISOString() }).in("user_id", staleUsers).is("read_at", null).lt("created_at", cutoff).select("id");
    if (error) console.error("  [FAIL] mark stale notifications:", error.message);
    else console.log(`  [OK]   marked ${data?.length ?? 0} stale notifications as read`);
  }

  // 17) assign unassigned CRM leads
  const salesId = userByEmail["sales@demo.beepabpo.com"];
  if (salesId) {
    const { data } = await sb.from("crm_leads").update({ assigned_sales_user_id: salesId }).is("assigned_sales_user_id", null).select("id, company_name");
    if (data?.length) console.log(`  [OK]   assigned ${data.length} leads to sales: ${data.map((d) => d.company_name).join(", ")}`);
    else console.log("  [skip] no unassigned leads");
  }

  // 18) re-open stuck ticket
  const { data: stuckTickets } = await sb.from("tickets").select("id, ticket_number, status, sla_due_at").eq("status", "new");
  if (stuckTickets?.length) {
    for (const t of stuckTickets) {
      const newSla = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
      await sb.from("tickets").update({
        status: "in_progress", assigned_user_id: salesId, assigned_team: "sales",
        sla_due_at: newSla, first_response_at: null,
      }).eq("id", t.id);
      await sb.from("ticket_status_history").insert({
        ticket_id: t.id, from_status: "new", to_status: "in_progress", changed_by: salesId, notes: "Re-opened by extended seed.",
      });
      console.log(`  [OK]   re-opened ticket ${t.ticket_number} with new SLA ${newSla}`);
    }
  }

  // 19) compute draft payroll records + create payslips
  //
  // Record status is DERIVED from the parent period, never chosen here. This
  // seed used to write `status: "finalized"` onto every draft record while
  // leaving the period in `draft`, which is exactly the incoherent state that
  // published 500,000 in unapproved net pay. It also stamped
  // `engine: "stub_v1"`, a label left over from the pre-fixed-salary engine;
  // `20260922120000_payroll_frequency_fixed_salary.sql` writes
  // `fixed_salary_v1` and that is the engine these numbers actually came from.
  const APPROVED_PERIOD_STATUSES = new Set(["finalized", "disbursed", "closed"]);
  const { data: periodsForSeed } = await sb
    .from("payroll_periods")
    .select("id, status");
  const periodStatusById = new Map(
    (periodsForSeed ?? []).map((p) => [p.id, p.status as string]),
  );
  const statusFor = (periodId: string) =>
    APPROVED_PERIOD_STATUSES.has(periodStatusById.get(periodId) ?? "")
      ? "finalized"
      : "calculated";

  const { data: draftRecords } = await sb.from("payroll_records").select("id, payroll_period_id, employee_id, status").in("status", ["draft", "calculated"]);
  const { data: profiles } = await sb.from("payroll_profiles").select("employee_id, base_salary, overtime_multiplier");
  const profByEmp = Object.fromEntries((profiles ?? []).map((p) => [p.employee_id, p]));
  let finalized = 0, payslipCount = 0, compsCount = 0;
  for (const r of draftRecords ?? []) {
    const prof = profByEmp[r.employee_id];
    const base = Number(prof?.base_salary ?? 25000);
    const otMult = Number(prof?.overtime_multiplier ?? 1.25);
    const worked = 4800, otMin = 120;
    const otPay = Math.round((base / 240) * (otMin / 60) * otMult);
    const allowances = 1500;
    const gross = base + otPay + allowances;
    const { error } = await sb.from("payroll_records").update({
      basic_pay: base, worked_minutes: worked, overtime_minutes: otMin, overtime_pay: otPay,
      allowances, gross_pay: gross, total_deductions: 0, net_pay: gross,
      calculation_snapshot: { seeded_by: "seed-demo-extended", engine: "fixed_salary_v1" },
      status: statusFor(r.payroll_period_id),
    }).eq("id", r.id);
    if (error) continue;
    finalized++;

    const existingComps = await sb.from("payroll_components").select("id").eq("payroll_record_id", r.id);
    if (!existingComps.data?.length) {
      await sb.from("payroll_components").insert([
        { payroll_record_id: r.id, type: "earning", code: "BASIC", label: "Basic salary (half month)", quantity: 0.5, rate: base * 2, amount: base, source_type: "payroll_profile" },
        { payroll_record_id: r.id, type: "earning", code: "OT", label: `Overtime (${otMin} min)`, quantity: otMin / 60, rate: Math.round(base / 240), amount: otPay, source_type: "attendance" },
        { payroll_record_id: r.id, type: "earning", code: "ALLOW", label: "Allowances", quantity: 1, rate: allowances, amount: allowances, source_type: "manual" },
      ]);
      compsCount++;
    }
    const existingPayslip = await sb.from("payslips").select("id").eq("payroll_record_id", r.id);
    if (!existingPayslip.data?.length) {
      await sb.from("payslips").insert({
        payroll_record_id: r.id, employee_id: r.employee_id, generated_at: new Date().toISOString(),
        pdf_path: `payslips/${r.employee_id}/${r.payroll_period_id.slice(0, 8)}-v1.pdf`, version: 1,
      });
      payslipCount++;
    }
  }
  console.log(`  [OK]   payroll_records computed: ${finalized} (components ${compsCount}, payslips ${payslipCount})`);
  console.log(`  [NOTE] Record status derived from the parent period; records in unapproved periods stay 'calculated'.`);

  // 20) dedupe leave_requests (catch any duplicates from previous runs)
  const { data: leaves } = await sb.from("leave_requests").select("id, employee_id, start_at, end_at, requested_minutes, created_at").order("created_at");
  const groups = new Map<string, any[]>();
  for (const l of leaves ?? []) {
    if (!l) continue;
    const k = `${l.employee_id}|${l.start_at}|${l.end_at}|${l.requested_minutes}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(l);
  }
  let deleted = 0;
  for (const items of groups.values()) {
    if (items.length <= 1) continue;
    const dupIds = items.slice(1).map((d) => d.id);
    const { data: linked } = await sb.from("approval_requests").select("id").eq("entity_type", "leave_request").in("entity_id", dupIds);
    const apIds = (linked ?? []).map((a) => a.id);
    if (apIds.length) {
      await sb.from("approval_actions").delete().in("request_id", apIds);
      await sb.from("approval_requests").delete().in("id", apIds);
    }
    await sb.from("leave_requests").delete().in("id", dupIds);
    deleted += dupIds.length;
  }
  if (deleted) console.log(`  [OK]   deduped leave_requests: removed ${deleted}`);
  else console.log("  [skip] no duplicate leave_requests");

  console.log("\n=== EXTENDED SEED DONE ===\n");
  console.log("Run `pnpm seed:demo` first, then this script. Both are idempotent.");
}

main().catch((e) => { console.error("FATAL", e.message); process.exit(1); });