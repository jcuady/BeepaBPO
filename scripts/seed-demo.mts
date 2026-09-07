import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BEEPA_ORG_ID = "11111111-1111-1111-1111-111111111111";
const CLOUDPEAK_SLUG = "cloudpeak";

type DemoUser = {
  email: string;
  role: string;
  org: "beepa" | "cloudpeak";
  membershipType: "internal" | "client" | "applicant";
  fullName: string;
  isPrimary?: boolean;
};

const DEMO_USERS: DemoUser[] = [
  { email: "owner@demo.beepabpo.com", role: "owner", org: "beepa", membershipType: "internal", fullName: "Demo Owner", isPrimary: true },
  { email: "superadmin@demo.beepabpo.com", role: "super_admin", org: "beepa", membershipType: "internal", fullName: "Demo Super Admin" },
  { email: "hr@demo.beepabpo.com", role: "hr", org: "beepa", membershipType: "internal", fullName: "Demo HR" },
  { email: "recruiter@demo.beepabpo.com", role: "recruiter", org: "beepa", membershipType: "internal", fullName: "Demo Recruiter" },
  { email: "sales@demo.beepabpo.com", role: "sales", org: "beepa", membershipType: "internal", fullName: "Demo Sales" },
  { email: "marketing@demo.beepabpo.com", role: "marketing", org: "beepa", membershipType: "internal", fullName: "Demo Marketing" },
  { email: "operations@demo.beepabpo.com", role: "operations", org: "beepa", membershipType: "internal", fullName: "Demo Operations" },
  { email: "teamlead@demo.beepabpo.com", role: "team_lead", org: "beepa", membershipType: "internal", fullName: "Demo Team Lead" },
  { email: "finance@demo.beepabpo.com", role: "finance", org: "beepa", membershipType: "internal", fullName: "Demo Finance" },
  { email: "employee@demo.beepabpo.com", role: "employee", org: "beepa", membershipType: "internal", fullName: "Demo Employee" },
  { email: "clientadmin@demo.beepabpo.com", role: "client_admin", org: "cloudpeak", membershipType: "client", fullName: "Demo Client Admin", isPrimary: true },
  { email: "clientviewer@demo.beepabpo.com", role: "client_viewer", org: "cloudpeak", membershipType: "client", fullName: "Demo Client Viewer" },
  { email: "applicant@demo.beepabpo.com", role: "applicant", org: "beepa", membershipType: "applicant", fullName: "Demo Applicant", isPrimary: true },
];

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

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "Demo",
    lastName: parts.slice(1).join(" ") || "User",
  };
}

async function ensureCloudPeakOrg(admin: SupabaseClient) {
  const { data: existing } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", CLOUDPEAK_SLUG)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await admin
    .from("organizations")
    .insert({
      type: "client",
      name: "CloudPeak",
      slug: CLOUDPEAK_SLUG,
      legal_name: "CloudPeak Inc.",
      country: "US",
      timezone: "America/New_York",
      status: "active",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create CloudPeak org: ${error?.message}`);
  console.log("Created CloudPeak client organization");
  return data.id;
}

async function ensureAuthUser(
  admin: SupabaseClient,
  email: string,
  password: string,
  fullName: string,
) {
  const { data: listed } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const existing = listed?.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  const { firstName, lastName } = splitName(fullName);

  if (existing) {
    // Keep Supabase Auth password in sync with DEMO_PASSWORD for demo autofill.
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        display_name: fullName,
      },
    });
    if (error) {
      throw new Error(
        `Failed to sync password for ${email}: ${error.message}`,
      );
    }
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      display_name: fullName,
    },
  });
  if (error || !data.user) {
    throw new Error(`Failed to create ${email}: ${error?.message ?? "unknown"}`);
  }
  return data.user.id;
}

async function attachMembership(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
  membershipType: "internal" | "client" | "applicant",
  roleCode: string,
  isPrimary: boolean,
) {
  const { data: membership, error } = await admin
    .from("organization_memberships")
    .upsert(
      {
        user_id: userId,
        organization_id: organizationId,
        membership_type: membershipType,
        status: "active",
        is_primary: isPrimary,
      },
      { onConflict: "organization_id,user_id" },
    )
    .select("id")
    .single();
  if (error || !membership) {
    throw new Error(`Membership failed for ${userId}: ${error?.message}`);
  }

  const { data: role } = await admin
    .from("roles")
    .select("id")
    .eq("code", roleCode)
    .single();
  if (!role) throw new Error(`Role not found: ${roleCode}`);

  await admin.from("membership_roles").upsert(
    { membership_id: membership.id, role_id: role.id },
    { onConflict: "membership_id,role_id" },
  );
}

async function ensureEmployee(
  admin: SupabaseClient,
  userId: string,
  email: string,
  jobTitle: string,
) {
  const { data: existing } = await admin
    .from("employees")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  if (existing) {
    await admin.from("employees").update({ work_email: email }).eq("id", existing.id);
    return existing.id;
  }

  let employeeNumber = `BEE-${Date.now().toString().slice(-5)}`;
  try {
    const { data: number } = await admin.rpc("generate_employee_number");
    if (typeof number === "string" && number) employeeNumber = number;
  } catch {
    // fall back
  }

  const { data, error } = await admin
    .from("employees")
    .insert({
      organization_id: BEEPA_ORG_ID,
      profile_id: userId,
      employee_number: employeeNumber,
      work_email: email,
      employment_status: "active",
      employment_type: "regular",
      job_title: jobTitle,
      hire_date: new Date().toISOString().slice(0, 10),
      default_timezone: "Asia/Manila",
    })
    .select("id")
    .single();
  if (error || !data) {
    console.warn(`Employee create skipped for ${email}: ${error?.message}`);
    return null;
  }
  return data.id;
}

async function main() {
  loadEnvFiles();
  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    console.error("Set DEMO_PASSWORD in .env.local before running seed:demo");
    process.exit(1);
  }

  const admin = createAdminClient();
  const cloudPeakId = await ensureCloudPeakOrg(admin);

  await admin.from("client_profiles").upsert({
    organization_id: cloudPeakId,
    industry: "Technology",
    website: "https://cloudpeak.example",
    primary_contact_name: "Demo Client Admin",
    primary_contact_email: "clientadmin@demo.beepabpo.com",
    billing_currency: "USD",
  });
  await admin.from("client_settings").upsert({
    client_organization_id: cloudPeakId,
    allow_attendance_view: true,
    allow_timesheet_approval: true,
    allow_performance_view: true,
    allow_billing_view: true,
    allow_documents_view: true,
    allow_ticketing: true,
  });

  let employeeDemoId: string | null = null;
  let ownerId: string | null = null;
  let ownerEmployeeId: string | null = null;
  let teamLeadEmployeeId: string | null = null;
  let applicantUserId: string | null = null;
  const internalEmployeeIds: string[] = [];

  for (const demo of DEMO_USERS) {
    const orgId = demo.org === "beepa" ? BEEPA_ORG_ID : cloudPeakId;
    const userId = await ensureAuthUser(admin, demo.email, password, demo.fullName);
    if (demo.email === "owner@demo.beepabpo.com") ownerId = userId;
    if (demo.email === "applicant@demo.beepabpo.com") applicantUserId = userId;

    await attachMembership(
      admin,
      userId,
      orgId,
      demo.membershipType,
      demo.role,
      demo.isPrimary ?? false,
    );

    if (
      demo.membershipType === "internal" &&
      demo.role !== "applicant" &&
      demo.role !== "employee"
    ) {
      await attachMembership(admin, userId, orgId, "internal", "employee", false);
    }

    if (demo.membershipType === "internal" && demo.role !== "applicant") {
      const empId = await ensureEmployee(
        admin,
        userId,
        demo.email,
        demo.role.replace(/_/g, " "),
      );
      if (empId) internalEmployeeIds.push(empId);
      if (demo.role === "employee") employeeDemoId = empId;
      if (demo.role === "owner") ownerEmployeeId = empId;
      if (demo.role === "team_lead") teamLeadEmployeeId = empId;
    }

    console.log(`Seeded ${demo.email} (${demo.role})`);
  }

  const assignedStaff = [employeeDemoId, teamLeadEmployeeId].filter(
    (id): id is string => Boolean(id),
  );
  for (const empId of assignedStaff) {
    const { data: existingAssignment } = await admin
      .from("employee_assignments")
      .select("id")
      .eq("employee_id", empId)
      .eq("client_organization_id", cloudPeakId)
      .maybeSingle();
    if (!existingAssignment) {
      await admin.from("employee_assignments").insert({
        employee_id: empId,
        client_organization_id: cloudPeakId,
        assignment_type: "client",
        role_title:
          empId === teamLeadEmployeeId
            ? "Team Lead"
            : "Customer Support Agent",
        start_date: new Date().toISOString().slice(0, 10),
        status: "active",
        billable: true,
      });
    }
  }

  if (ownerEmployeeId) {
    await admin
      .from("client_profiles")
      .update({ account_manager_employee_id: ownerEmployeeId })
      .eq("organization_id", cloudPeakId);
  }

  const year = new Date().getFullYear();
  const { data: leaveTypes } = await admin
    .from("leave_types")
    .select("id, code")
    .eq("organization_id", BEEPA_ORG_ID);
  const minutesByCode: Record<string, number> = {
    PTO: 15 * 480,
    SICK: 10 * 480,
    VACATION: 10 * 480,
    EMERGENCY: 3 * 480,
    BEREAVEMENT: 3 * 480,
    UPTO: 5 * 480,
  };
  for (const empId of internalEmployeeIds) {
    for (const type of leaveTypes ?? []) {
      const entitled = minutesByCode[type.code] ?? 0;
      if (!entitled) continue;
      await admin.from("leave_balances").upsert(
        {
          employee_id: empId,
          leave_type_id: type.id,
          period_year: year,
          entitled_minutes: entitled,
          used_minutes: 0,
          pending_minutes: 0,
        },
        { onConflict: "employee_id,leave_type_id,period_year" },
      );
    }
  }

  if (employeeDemoId) {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    for (let i = 0; i < 5; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const workDate = day.toISOString().slice(0, 10);
      const start = new Date(`${workDate}T01:00:00.000Z`);
      const end = new Date(`${workDate}T10:00:00.000Z`);
      await admin.from("shift_assignments").upsert(
        {
          employee_id: employeeDemoId,
          work_date: workDate,
          scheduled_start: start.toISOString(),
          scheduled_end: end.toISOString(),
          status: "scheduled",
          source: "manual",
        },
        { onConflict: "employee_id,work_date" },
      );
    }
  }

  const periodStart = `${year}-09-01`;
  const periodEnd = `${year}-09-15`;
  const { data: existingPeriod } = await admin
    .from("payroll_periods")
    .select("id")
    .eq("organization_id", BEEPA_ORG_ID)
    .eq("start_date", periodStart)
    .maybeSingle();
  if (!existingPeriod) {
    await admin.from("payroll_periods").insert({
      organization_id: BEEPA_ORG_ID,
      name: "September 1–15, 2026",
      start_date: periodStart,
      end_date: periodEnd,
      pay_date: `${year}-09-20`,
      status: "preparing",
      created_by: ownerId,
    });
  }

  const { data: existingInvoice } = await admin
    .from("invoices")
    .select("id")
    .eq("invoice_number", "INV-CP-2026-09")
    .maybeSingle();
  if (!existingInvoice) {
    await admin.from("invoices").insert({
      client_organization_id: cloudPeakId,
      invoice_number: "INV-CP-2026-09",
      period_start: periodStart,
      period_end: periodEnd,
      issue_date: `${year}-09-16`,
      due_date: `${year}-09-30`,
      subtotal: 12480,
      adjustments: 0,
      total: 12480,
      currency: "USD",
      status: "issued",
    });
  }

  if (ownerId) {
    await admin.from("job_posts").upsert(
      {
        organization_id: BEEPA_ORG_ID,
        title: "Customer Support Specialist",
        slug: "customer-support-specialist",
        employment_type: "regular",
        location_type: "hybrid",
        location_text: "Makati / Remote",
        description:
          "Join Beepa and help world-class clients deliver outstanding support.",
        responsibilities:
          "Handle customer inquiries\nDocument issues\nCollaborate with account managers",
        requirements:
          "Strong English\nCRM experience\nCustomer-first mindset",
        status: "published",
        published_at: new Date().toISOString(),
        created_by: ownerId,
      },
      { onConflict: "organization_id,slug" },
    );
  }

  // --- Demo-harden: fill empty role surfaces (lists only; no Storage/PDF) ---
  const { data: jobPost } = await admin
    .from("job_posts")
    .select("id")
    .eq("slug", "customer-support-specialist")
    .maybeSingle();

  if (applicantUserId && jobPost) {
    const { data: existingApplicant } = await admin
      .from("applicants")
      .select("id")
      .eq("email", "applicant@demo.beepabpo.com")
      .maybeSingle();
    let applicantRowId = existingApplicant?.id;
    if (!applicantRowId) {
      const { data: inserted } = await admin
        .from("applicants")
        .insert({
          profile_id: applicantUserId,
          email: "applicant@demo.beepabpo.com",
          first_name: "Demo",
          last_name: "Applicant",
          source: "demo_seed",
        })
        .select("id")
        .single();
      applicantRowId = inserted?.id;
    }
    if (applicantRowId) {
      const { data: existingApp } = await admin
        .from("job_applications")
        .select("id")
        .eq("applicant_id", applicantRowId)
        .eq("job_post_id", jobPost.id)
        .maybeSingle();
      if (!existingApp) {
        await admin.from("job_applications").insert({
          applicant_id: applicantRowId,
          job_post_id: jobPost.id,
          stage: "screening",
          notes: "Demo seeded application",
        });
      }
    }
  }

  let periodId = existingPeriod?.id as string | undefined;
  if (!periodId) {
    const { data: periodRow } = await admin
      .from("payroll_periods")
      .select("id")
      .eq("organization_id", BEEPA_ORG_ID)
      .eq("start_date", periodStart)
      .maybeSingle();
    periodId = periodRow?.id;
  }
  if (periodId) {
    await admin
      .from("payroll_periods")
      .update({ status: "finalized" })
      .eq("id", periodId);
  }
  if (periodId && employeeDemoId) {
    await admin.from("payroll_records").upsert(
      {
        payroll_period_id: periodId,
        employee_id: employeeDemoId,
        basic_pay: 25000,
        worked_minutes: 4800,
        gross_pay: 28000,
        total_deductions: 3500,
        net_pay: 24500,
        status: "finalized",
        calculation_snapshot: { seeded: true },
      },
      { onConflict: "payroll_period_id,employee_id" },
    );
  }

  if (employeeDemoId) {
    const { data: existingDoc } = await admin
      .from("documents")
      .select("id")
      .eq("employee_id", employeeDemoId)
      .eq("title", "Demo Employment Contract")
      .maybeSingle();
    if (!existingDoc) {
      await admin.from("documents").insert({
        organization_id: BEEPA_ORG_ID,
        employee_id: employeeDemoId,
        category: "contract",
        title: "Demo Employment Contract",
        storage_bucket: "employee-documents",
        storage_path: `demo/${employeeDemoId}/employment-contract.pdf`,
        mime_type: "application/pdf",
        visibility: "employee_visible",
        uploaded_by: ownerId,
      });
    }

    const { data: existingKpi } = await admin
      .from("performance_kpis")
      .select("id")
      .eq("employee_id", employeeDemoId)
      .eq("code", "QA_SCORE")
      .maybeSingle();
    if (!existingKpi) {
      await admin.from("performance_kpis").insert({
        employee_id: employeeDemoId,
        code: "QA_SCORE",
        label: "QA Score",
        target_value: 95,
        actual_value: 92,
        visibility: "client_visible",
      });
    }
  }

  const { data: existingClientDoc } = await admin
    .from("documents")
    .select("id")
    .eq("client_organization_id", cloudPeakId)
    .eq("title", "Demo MSA Summary")
    .maybeSingle();
  if (!existingClientDoc) {
    await admin.from("documents").insert({
      organization_id: BEEPA_ORG_ID,
      client_organization_id: cloudPeakId,
      category: "contract",
      title: "Demo MSA Summary",
      storage_bucket: "client-documents",
      storage_path: `demo/cloudpeak/msa-summary.pdf`,
      mime_type: "application/pdf",
      visibility: "client_visible",
      uploaded_by: ownerId,
    });
  }

  console.log("Demo users seeded.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
