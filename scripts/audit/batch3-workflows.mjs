// Batch 3: end-to-end workflow data.
// - payroll_profiles for all 10 employees (base salary, semi_monthly, overtime multiplier)
// - departments (5) + teams (5) for Beepa internal org
// - holiday_calendars (PH + US) + 2026 holidays
// - client_contacts (2) for CloudPeak
// - application_stage_history + 1 interview + 1 assessment for the seeded applicant
// - performance_cycles (2026 Q3) + attach orphan KPI to it + add 2 more KPIs
// - cash_advance_requests (1 pending from employee demo)
// - nte_cases (1 issued, awaiting response)
// - approval_requests for cash advance + nte
// All idempotent upserts.
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

async function upsertIdempotent(table, rows, conflict, label) {
  if (!rows.length) return;
  const { error, count } = await sb.from(table).upsert(rows, { onConflict: conflict, count: "exact" });
  if (error) console.error(`  [FAIL] ${label}:`, error.message);
  else console.log(`  [OK]   ${label.padEnd(38)} +${count ?? rows.length} rows`);
}

async function main() {
  console.log("=== BATCH 3 — End-to-end workflow data ===\n");

  // 1) departments (5)
  console.log("--- departments ---");
  await upsertIdempotent(
    "departments",
    [
      { organization_id: BEEPA_ORG_ID, name: "Customer Operations", code: "CX", status: "active" },
      { organization_id: BEEPA_ORG_ID, name: "Marketing", code: "MKT", status: "active" },
      { organization_id: BEEPA_ORG_ID, name: "People Operations", code: "PPL", status: "active" },
      { organization_id: BEEPA_ORG_ID, name: "Finance & Payroll", code: "FIN", status: "active" },
      { organization_id: BEEPA_ORG_ID, name: "Engineering", code: "ENG", status: "active" },
    ],
    "organization_id,code",
    "departments",
  );

  // Fetch dept IDs
  const { data: depts } = await sb.from("departments").select("id, code").eq("organization_id", BEEPA_ORG_ID);
  const deptByCode = Object.fromEntries((depts ?? []).map((d) => [d.code, d.id]));

  // 2) teams (5)
  console.log("\n--- teams ---");
  await upsertIdempotent(
    "teams",
    [
      { organization_id: BEEPA_ORG_ID, department_id: deptByCode["CX"], name: "Voice Support" },
      { organization_id: BEEPA_ORG_ID, department_id: deptByCode["CX"], name: "Back Office" },
      { organization_id: BEEPA_ORG_ID, department_id: deptByCode["MKT"], name: "Content & Campaigns" },
      { organization_id: BEEPA_ORG_ID, department_id: deptByCode["FIN"], name: "Payroll Operations" },
      { organization_id: BEEPA_ORG_ID, department_id: deptByCode["ENG"], name: "Platform" },
    ],
    "id",
    "teams",
  );

  // Fetch team IDs
  const { data: teams } = await sb.from("teams").select("id, name").eq("organization_id", BEEPA_ORG_ID);
  const teamByName = Object.fromEntries((teams ?? []).map((t) => [t.name, t.id]));

  // 3) employee assignments: assign the seed demo team members to teams + departments.
  console.log("\n--- employee updates (department, team) ---");
  // Read employees
  const { data: emps } = await sb.from("employees").select("id, job_title, profiles(email)").eq("organization_id", BEEPA_ORG_ID);
  let updated = 0;
  for (const e of emps ?? []) {
    const email = e.profiles?.email ?? "";
    const patch = {};
    if (email.startsWith("employee") || email.startsWith("teamlead")) {
      patch.department_id = deptByCode["CX"];
      patch.team_id = teamByName["Voice Support"];
    } else if (email.startsWith("marketing")) {
      patch.department_id = deptByCode["MKT"];
      patch.team_id = teamByName["Content & Campaigns"];
    } else if (email.startsWith("hr")) {
      patch.department_id = deptByCode["PPL"];
    } else if (email.startsWith("finance")) {
      patch.department_id = deptByCode["FIN"];
      patch.team_id = teamByName["Payroll Operations"];
    } else if (email.startsWith("operations") || email.startsWith("account_manager")) {
      patch.department_id = deptByCode["CX"];
      patch.team_id = teamByName["Voice Support"];
    } else if (email.startsWith("sales") || email.startsWith("recruiter")) {
      patch.department_id = deptByCode["CX"];
    } else {
      patch.department_id = deptByCode["ENG"];
      patch.team_id = teamByName["Platform"];
    }
    const { error } = await sb.from("employees").update(patch).eq("id", e.id);
    if (!error) updated++;
  }
  console.log(`  [OK]   employees updated                                +${updated}`);

  // 4) holiday_calendars (PH + US)
  console.log("\n--- holiday_calendars + holidays ---");
  await upsertIdempotent(
    "holiday_calendars",
    [
      { organization_id: BEEPA_ORG_ID, name: "Philippines 2026", timezone: "Asia/Manila", active: true },
      { organization_id: BEEPA_ORG_ID, client_organization_id: CLOUDPEAK_ORG_ID, name: "US Federal 2026", timezone: "America/New_York", active: true },
    ],
    "id",
    "holiday_calendars",
  );
  const { data: calendars } = await sb.from("holiday_calendars").select("id, name").eq("organization_id", BEEPA_ORG_ID);
  const calByName = Object.fromEntries((calendars ?? []).map((c) => [c.name, c.id]));

  await upsertIdempotent(
    "holidays",
    [
      // PH 2026
      { holiday_calendar_id: calByName["Philippines 2026"], name: "New Year's Day",                  holiday_date: "2026-01-01", is_recurring: true },
      { holiday_calendar_id: calByName["Philippines 2026"], name: "Maundy Thursday",                 holiday_date: "2026-04-02", is_recurring: false },
      { holiday_calendar_id: calByName["Philippines 2026"], name: "Good Friday",                     holiday_date: "2026-04-03", is_recurring: false },
      { holiday_calendar_id: calByName["Philippines 2026"], name: "Day of Valor (Araw ng Kagitingan)", holiday_date: "2026-04-09", is_recurring: true },
      { holiday_calendar_id: calByName["Philippines 2026"], name: "Labor Day",                       holiday_date: "2026-05-01", is_recurring: true },
      { holiday_calendar_id: calByName["Philippines 2026"], name: "Independence Day",                holiday_date: "2026-06-12", is_recurring: true },
      { holiday_calendar_id: calByName["Philippines 2026"], name: "Eid'l Adha",                      holiday_date: "2026-05-27", is_recurring: false },
      { holiday_calendar_id: calByName["Philippines 2026"], name: "Ninoy Aquino Day",                holiday_date: "2026-08-21", is_recurring: true },
      { holiday_calendar_id: calByName["Philippines 2026"], name: "National Heroes Day",              holiday_date: "2026-08-31", is_recurring: true },
      { holiday_calendar_id: calByName["Philippines 2026"], name: "Bonifacio Day",                   holiday_date: "2026-11-30", is_recurring: true },
      { holiday_calendar_id: calByName["Philippines 2026"], name: "Christmas Day",                   holiday_date: "2026-12-25", is_recurring: true },
      { holiday_calendar_id: calByName["Philippines 2026"], name: "Rizal Day",                       holiday_date: "2026-12-30", is_recurring: true },
      // US 2026 (selected federal)
      { holiday_calendar_id: calByName["US Federal 2026"], name: "New Year's Day",                  holiday_date: "2026-01-01", is_recurring: true },
      { holiday_calendar_id: calByName["US Federal 2026"], name: "Memorial Day",                    holiday_date: "2026-05-25", is_recurring: false },
      { holiday_calendar_id: calByName["US Federal 2026"], name: "Independence Day",                holiday_date: "2026-07-03", is_recurring: false },
      { holiday_calendar_id: calByName["US Federal 2026"], name: "Labor Day",                       holiday_date: "2026-09-07", is_recurring: false },
      { holiday_calendar_id: calByName["US Federal 2026"], name: "Thanksgiving",                    holiday_date: "2026-11-26", is_recurring: false },
      { holiday_calendar_id: calByName["US Federal 2026"], name: "Christmas Day",                   holiday_date: "2026-12-25", is_recurring: true },
    ],
    "holiday_calendar_id,holiday_date",
    "holidays",
  );

  // 5) payroll_profiles for every employee
  console.log("\n--- payroll_profiles ---");
  // salary heuristic: employee = 25k, team_lead = 35k, hr/recruiter/sales/marketing/operations/finance = 45k, owner = 75k
  const roleSalary = {
    employee: 25000, team_lead: 35000, hr: 45000, recruiter: 40000,
    sales: 45000, marketing: 45000, operations: 55000, finance: 55000,
    super_admin: 85000, owner: 120000,
  };
  const { data: empsFull } = await sb.from("employees").select("id, profiles(email), job_title").eq("organization_id", BEEPA_ORG_ID);
  const profilesRows = [];
  for (const e of empsFull ?? []) {
    const email = e.profiles?.email ?? "";
    const role = Object.keys(roleSalary).find((r) => email.startsWith(r));
    const salary = roleSalary[role ?? "employee"] ?? 25000;
    profilesRows.push({
      employee_id: e.id,
      pay_frequency: "semi_monthly",
      compensation_type: "monthly_salary",
      base_salary: salary,
      hourly_rate: null,
      daily_rate: null,
      currency: "PHP",
      overtime_multiplier: 1.25,
      active: true,
    });
  }
  await upsertIdempotent("payroll_profiles", profilesRows, "employee_id", "payroll_profiles");

  // 6) client_contacts for CloudPeak
  console.log("\n--- client_contacts ---");
  await upsertIdempotent(
    "client_contacts",
    [
      { client_organization_id: CLOUDPEAK_ORG_ID, name: "Ana Reyes",  email: "ana@cloudpeak.example", phone: "+1 (415) 555-0117", job_title: "VP Customer Experience", is_primary: true },
      { client_organization_id: CLOUDPEAK_ORG_ID, name: "Marcus Lin", email: "marcus@cloudpeak.example", phone: "+1 (415) 555-0182", job_title: "Head of Operations", is_primary: false },
    ],
    "id",
    "client_contacts",
  );

  // 7) ATS history for the seeded applicant
  console.log("\n--- ATS: stage_history + interview + assessment ---");
  const { data: appRows } = await sb.from("job_applications").select("id, applicant_id, job_post_id");
  const applicantUser = "c753f9ad-eb0a-48aa-9cd4-2c785b1e5c3e"; // demo applicant
  const recruiterUser = "b73c753e-b8aa-4dd4-9f92-3c854ed48aa4"; // demo recruiter
  for (const a of appRows ?? []) {
    const existing = await sb.from("application_stage_history").select("id").eq("job_application_id", a.id);
    if (!existing.data?.length) {
      await sb.from("application_stage_history").insert([
        { job_application_id: a.id, from_stage: null, to_stage: "applied", changed_by: applicantUser, notes: "Submitted via /careers/customer-support-specialist", created_at: new Date(Date.now() - 9 * 86400000).toISOString() },
        { job_application_id: a.id, from_stage: "applied", to_stage: "screening", changed_by: recruiterUser, notes: "Resume passed initial review", created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
        { job_application_id: a.id, from_stage: "screening", to_stage: "initial_interview", changed_by: recruiterUser, notes: "Phone screen scheduled", created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
      ]);
      console.log("  [OK]   application_stage_history seeded for", a.id.slice(0, 8));
    }
    // 1 interview
    const intv = await sb.from("interviews").select("id").eq("job_application_id", a.id);
    if (!intv.data?.length) {
      await sb.from("interviews").insert({
        job_application_id: a.id,
        interviewer_user_id: recruiterUser,
        scheduled_at: new Date(Date.now() + 2 * 86400000).toISOString(),
        duration_minutes: 45,
        location: "Zoom",
        meeting_url: "https://meet.example/beepa-intv-" + a.id.slice(0, 6),
        status: "scheduled",
        notes: "Demo applicant — run role-play on customer empathy + escalation.",
      });
      console.log("  [OK]   interviews seeded for", a.id.slice(0, 8));
    }
    // 1 assessment
    const ass = await sb.from("assessments").select("id").eq("job_application_id", a.id);
    if (!ass.data?.length) {
      await sb.from("assessments").insert({
        job_application_id: a.id,
        title: "Written customer response scenario",
        assessment_type: "written",
        score: 85,
        max_score: 100,
        completed_at: new Date(Date.now() - 1 * 86400000).toISOString(),
        notes: "Demo: applicant wrote a clear, empathetic refund response.",
      });
      console.log("  [OK]   assessments seeded for", a.id.slice(0, 8));
    }
  }

  // 8) performance_cycles
  console.log("\n--- performance_cycles ---");
  await upsertIdempotent(
    "performance_cycles",
    [
      { organization_id: BEEPA_ORG_ID, name: "2026 Q3 (Jul-Sep)", start_date: "2026-07-01", end_date: "2026-09-30", status: "active" },
      { organization_id: BEEPA_ORG_ID, name: "2026 Q2 (Apr-Jun)", start_date: "2026-04-01", end_date: "2026-06-30", status: "closed" },
    ],
    "id",
    "performance_cycles",
  );
  const { data: cycles } = await sb.from("performance_cycles").select("id, name").eq("organization_id", BEEPA_ORG_ID);
  const q3Cycle = (cycles ?? []).find((c) => c.name.includes("Q3"));
  const q2Cycle = (cycles ?? []).find((c) => c.name.includes("Q2"));

  // 9) attach orphan KPI + add 2 more for the demo employee
  console.log("\n--- performance_kpis (attach + add) ---");
  const { data: orphanKpis } = await sb.from("performance_kpis").select("id, employee_id, code, label, target_value, actual_value").is("cycle_id", null);
  let kpiCount = 0;
  for (const k of orphanKpis ?? []) {
    const { error } = await sb.from("performance_kpis").update({ cycle_id: q3Cycle?.id }).eq("id", k.id);
    if (!error) kpiCount++;
  }
  // Add CSAT + AHT for the demo employee
  const { data: empsKpi } = await sb.from("employees").select("id, profiles(email)").eq("organization_id", BEEPA_ORG_ID);
  const demoEmp = (empsKpi ?? []).find((e) => e.profiles?.email?.startsWith("employee"));
  if (demoEmp) {
    const existing2 = await sb.from("performance_kpis").select("code").eq("employee_id", demoEmp.id);
    const codes = (existing2.data ?? []).map((k) => k.code);
    const additions = [];
    if (!codes.includes("CSAT")) additions.push({ employee_id: demoEmp.id, cycle_id: q3Cycle?.id, code: "CSAT", label: "CSAT", target_value: 4.5, actual_value: 4.7, weight: 1, visibility: "client_visible" });
    if (!codes.includes("AHT")) additions.push({ employee_id: demoEmp.id, cycle_id: q3Cycle?.id, code: "AHT", label: "Average Handle Time (min)", target_value: 7, actual_value: 6.8, weight: 1, visibility: "client_visible" });
    if (!codes.includes("ATTENDANCE_PCT")) additions.push({ employee_id: demoEmp.id, cycle_id: q3Cycle?.id, code: "ATTENDANCE_PCT", label: "Attendance %", target_value: 95, actual_value: 98.2, weight: 1, visibility: "employee_visible" });
    if (additions.length) await upsertIdempotent("performance_kpis", additions, "id", `performance_kpis (${additions.length} new)`);
  }
  console.log(`  [OK]   attached ${kpiCount} orphan KPIs to Q3 cycle`);

  // 10) cash_advance_requests (1 pending for demo employee)
  console.log("\n--- cash_advance_requests ---");
  const { data: empCash } = await sb.from("employees").select("id, profiles(email)").eq("organization_id", BEEPA_ORG_ID);
  const cashEmp = (empCash ?? []).find((e) => e.profiles?.email?.startsWith("employee"));
  if (cashEmp) {
    const existingCa = await sb.from("cash_advance_requests").select("id").eq("employee_id", cashEmp.id).eq("reason", "Demo: emergency medical expense");
    if (!existingCa.data?.length) {
      const { data: ins, error } = await sb
        .from("cash_advance_requests")
        .insert({
          employee_id: cashEmp.id,
          requested_amount: 8000,
          reason: "Demo: emergency medical expense for a family member.",
          requested_repayment_periods: 4,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) console.error("  [FAIL] cash_advance insert:", error.message);
      else {
        console.log("  [OK]   cash_advance_requests inserted for demo employee");
        // create approval request via workflow
        const wf = await sb.from("approval_workflows").select("id").eq("code", "cash_advance").eq("active", true).maybeSingle();
        if (wf?.data) {
          const step = await sb.from("approval_steps").select("step_order, name").eq("workflow_id", wf.data.id).order("step_order").limit(1);
          await sb.from("approval_requests").insert({
            workflow_id: wf.data.id,
            entity_type: "cash_advance",
            entity_id: ins.id,
            requester_user_id: "95435164-2938-43e6-891e-c44aa1d9e917",
            current_step: step.data?.[0]?.step_order ?? 1,
            status: "pending",
            payload: { requested_amount: 8000, reason: "Demo: emergency medical expense for a family member." },
          });
          console.log("  [OK]   approval_request seeded for cash advance");
        }
      }
    } else {
      console.log("  [skip] cash_advance_requests already exists");
    }
  }

  // 11) nte_cases (1 issued, awaiting response)
  console.log("\n--- nte_cases ---");
  const { data: empNte } = await sb.from("employees").select("id, profiles(email)").eq("organization_id", BEEPA_ORG_ID);
  const nteEmp = (empNte ?? []).find((e) => e.profiles?.email?.startsWith("employee"));
  if (nteEmp) {
    const existingNte = await sb.from("nte_cases").select("id, case_number").eq("employee_id", nteEmp.id).eq("incident_type", "attendance_pattern");
    if (!existingNte.data?.length) {
      // Generate a unique-ish case number
      const caseNum = `NTE-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const { data: ins, error } = await sb.from("nte_cases").insert({
        employee_id: nteEmp.id,
        case_number: caseNum,
        incident_date: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
        incident_type: "attendance_pattern",
        subject: "Three consecutive unauthorized late clock-ins",
        description: "Employee clocked in late by 30+ minutes on three consecutive scheduled shifts without prior notice or approval.",
        issued_by: "9e72049e-a5e2-4ca3-8d25-df5af7d5b829", // HR
        issued_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        response_due_at: new Date(Date.now() + 5 * 86400000).toISOString(),
        status: "awaiting_response",
        evidence_urls: [],
      }).select("id").single();
      if (error) console.error("  [FAIL] nte_cases insert:", error.message);
      else console.log("  [OK]   nte_cases inserted:", caseNum);
    } else {
      console.log("  [skip] nte_cases already exists");
    }
  }

  // 12) audit log: add a couple of representative entries (for admin/audit page)
  console.log("\n--- audit_logs (a few representative entries) ---");
  const auditEntries = [
    { actor_user_id: "9e72049e-a5e2-4ca3-8d25-df5af7d5b829", action: "leave.approve", entity_type: "leave_request", entity_id: null, after_data: { step: "hr", decision: "approved" }, organization_id: BEEPA_ORG_ID },
    { actor_user_id: "5f7e9eaf-fe45-46b8-8391-bbc5d682a242", action: "client.invite", entity_type: "client_organization", entity_id: CLOUDPEAK_ORG_ID, after_data: { invite_email: "clientadmin@demo.beepabpo.com" }, organization_id: CLOUDPEAK_ORG_ID },
    { actor_user_id: "b73c753e-b8aa-4dd4-9f92-3c854ed48aa4", action: "applicant.stage_change", entity_type: "job_application", entity_id: null, after_data: { from: "applied", to: "screening" }, organization_id: BEEPA_ORG_ID },
  ];
  for (const e of auditEntries) {
    const { error } = await sb.from("audit_logs").insert({ ...e, ip_address: null, user_agent: "audit/seed-script" });
    if (error && error.message?.includes("duplicate")) continue;
    if (error) console.error("  [FAIL] audit insert:", error.message);
  }
  console.log("  [OK]   audit_logs seeded (3 entries)");

  console.log("\n=== BATCH 3 DONE ===");
}

main().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});