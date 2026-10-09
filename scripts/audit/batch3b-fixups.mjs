// Batch 3b: retry the parts that silently no-op'd because of the missing
// profiles(email) column. Use employees.work_email instead.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BEEPA_ORG_ID = "11111111-1111-1111-1111-111111111111";
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

const roleSalary = {
  employee: 25000, team_lead: 35000, hr: 45000, recruiter: 40000,
  sales: 45000, marketing: 45000, operations: 55000, finance: 55000,
  super_admin: 85000, owner: 120000,
};

async function main() {
  console.log("=== BATCH 3b — Retry payroll_profiles, employee updates, cash advance, NTE ===\n");

  const { data: depts } = await sb.from("departments").select("id, code").eq("organization_id", BEEPA_ORG_ID);
  const deptByCode = Object.fromEntries((depts ?? []).map((d) => [d.code, d.id]));
  const { data: teams } = await sb.from("teams").select("id, name").eq("organization_id", BEEPA_ORG_ID);
  const teamByName = Object.fromEntries((teams ?? []).map((t) => [t.name, t.id]));

  // Use work_email for the lookup.
  const { data: emps, error: empErr } = await sb
    .from("employees")
    .select("id, work_email, profile_id, job_title")
    .eq("organization_id", BEEPA_ORG_ID);
  if (empErr) { console.error("read emps failed:", empErr.message); return; }
  console.log(`  employees: ${emps?.length ?? 0}`);

  // payroll_profiles
  console.log("\n--- payroll_profiles ---");
  const profileRows = [];
  for (const e of emps ?? []) {
    const email = e.work_email ?? "";
    const role = Object.keys(roleSalary).find((r) => email.startsWith(r));
    const salary = roleSalary[role ?? "employee"] ?? 25000;
    profileRows.push({
      employee_id: e.id,
      pay_frequency: "semi_monthly",
      compensation_type: "monthly_salary",
      base_salary: salary,
      currency: "PHP",
      overtime_multiplier: 1.25,
      active: true,
    });
  }
  const { error: ppErr, count } = await sb.from("payroll_profiles").upsert(profileRows, { onConflict: "employee_id", count: "exact" });
  if (ppErr) console.error("  [FAIL] payroll_profiles:", ppErr.message);
  else console.log(`  [OK]   payroll_profiles upserted: ${count ?? profileRows.length}`);

  // employee department + team
  console.log("\n--- employee updates ---");
  let updated = 0;
  for (const e of emps ?? []) {
    const email = e.work_email ?? "";
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
    } else if (email.startsWith("operations")) {
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
  console.log(`  [OK]   employees updated: ${updated}`);

  // cash_advance_requests
  console.log("\n--- cash_advance_requests ---");
  const demoEmp = (emps ?? []).find((e) => (e.work_email ?? "").startsWith("employee@"));
  if (demoEmp) {
    const existing = await sb.from("cash_advance_requests").select("id").eq("employee_id", demoEmp.id).eq("reason", "Demo: emergency medical expense");
    if (!existing.data?.length) {
      const { data: ins, error } = await sb.from("cash_advance_requests").insert({
        employee_id: demoEmp.id,
        requested_amount: 8000,
        reason: "Demo: emergency medical expense for a family member.",
        requested_repayment_periods: 4,
        status: "pending",
      }).select("id").single();
      if (error) console.error("  [FAIL] cash_advance insert:", error.message);
      else {
        console.log(`  [OK]   cash_advance_requests inserted for ${demoEmp.work_email}`);
        const wf = await sb.from("approval_workflows").select("id").eq("code", "cash_advance").eq("active", true).maybeSingle();
        if (wf?.data) {
          const step = await sb.from("approval_steps").select("step_order").eq("workflow_id", wf.data.id).order("step_order").limit(1);
          // requester_user_id: must be auth user. demo employee has profile_id → use that.
          const requesterUserId = demoEmp.profile_id;
          if (requesterUserId) {
            await sb.from("approval_requests").insert({
              workflow_id: wf.data.id,
              entity_type: "cash_advance",
              entity_id: ins.id,
              requester_user_id: requesterUserId,
              current_step: step.data?.[0]?.step_order ?? 1,
              status: "pending",
              payload: { requested_amount: 8000, reason: "Demo: emergency medical expense for a family member." },
            });
            console.log("  [OK]   approval_request seeded for cash advance");
          }
        }
      }
    } else {
      console.log("  [skip] cash_advance_requests already exists");
    }
  } else {
    console.log("  [skip] no employee@demo.beepabpo.com employee found");
  }

  // nte_cases
  console.log("\n--- nte_cases ---");
  const nteEmp = (emps ?? []).find((e) => (e.work_email ?? "").startsWith("employee@"));
  if (nteEmp) {
    const existingNte = await sb.from("nte_cases").select("id").eq("employee_id", nteEmp.id).eq("incident_type", "attendance_pattern");
    if (!existingNte.data?.length) {
      const caseNum = `NTE-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      // HR user id from profiles for issued_by
      const { data: hrProf } = await sb.from("profiles").select("id").ilike("display_name", "%HR%").maybeSingle();
      const issuedBy = hrProf?.id ?? null;
      const { data: ins, error } = await sb.from("nte_cases").insert({
        employee_id: nteEmp.id,
        case_number: caseNum,
        incident_date: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
        incident_type: "attendance_pattern",
        subject: "Three consecutive unauthorized late clock-ins",
        description: "Employee clocked in late by 30+ minutes on three consecutive scheduled shifts without prior notice or approval.",
        issued_by: issuedBy,
        issued_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        response_due_at: new Date(Date.now() + 5 * 86400000).toISOString(),
        status: "awaiting_response",
        evidence_urls: [],
      }).select("id, case_number").single();
      if (error) console.error("  [FAIL] nte_cases insert:", error.message);
      else console.log(`  [OK]   nte_cases inserted: ${ins.case_number}`);
    } else {
      console.log("  [skip] nte_cases already exists");
    }
  }
  console.log("\n=== BATCH 3b DONE ===");
}

main().catch((e) => { console.error("FATAL", e.message); process.exit(1); });