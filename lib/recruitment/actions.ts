"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { canAll } from "@/lib/permissions/can";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import { inviteOrResolveAuthUser } from "@/lib/auth/invite-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  hireApplicantSchema,
  jobApplicationSchema,
  jobPostIdSchema,
  jobPostSchema,
  jobPostUpdateSchema,
} from "@/lib/validation/app";
import type { Database } from "@/types/database";

type JobPostStatus = Database["public"]["Enums"]["job_post_status"];
type LocationType = Database["public"]["Enums"]["location_type"];
type EmploymentType = Database["public"]["Enums"]["employment_type"];

function publishedAtForStatus(
  status: JobPostStatus,
  previousPublishedAt: string | null,
): string | null {
  if (status === "published") {
    return previousPublishedAt ?? new Date().toISOString();
  }
  if (status === "draft") return null;
  return previousPublishedAt;
}

export async function createJobPost(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  requirePermission(workspace, "recruitment.manage");

  const parsed = jobPostSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Please check the form and try again.",
    };
  }

  const status = (parsed.data.status ?? "draft") as JobPostStatus;
  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("job_posts")
    .insert({
      organization_id: BEEPA_ORG_ID,
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description ?? "",
      requirements: parsed.data.requirements ?? "",
      responsibilities: parsed.data.responsibilities ?? "",
      location_text: parsed.data.location_text ?? null,
      location_type: (parsed.data.location_type ?? "hybrid") as LocationType,
      employment_type: (parsed.data.employment_type ??
        "regular") as EmploymentType,
      salary_display: parsed.data.salary_display ?? null,
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
      created_by: workspace.user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message ?? "Unable to create job post." };
  }

  const { logAudit } = await import("@/lib/audit/log");
  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: BEEPA_ORG_ID,
    action: "job_post.create",
    entityType: "job_post",
    entityId: created?.id,
    after: { title: parsed.data.title, status },
  });

  revalidatePath("/app/recruitment/jobs");
  revalidatePath("/careers");
  return { ok: true, message: "Job post saved." };
}

export async function updateJobPost(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  requirePermission(workspace, "recruitment.manage");

  const parsed = jobPostUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Please check the form and try again.",
    };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("job_posts")
    .select("id, status, published_at, slug, title")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Job post not found." };
  }

  const status = (parsed.data.status ?? existing.status) as JobPostStatus;
  const { error } = await supabase
    .from("job_posts")
    .update({
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description ?? "",
      requirements: parsed.data.requirements ?? "",
      responsibilities: parsed.data.responsibilities ?? "",
      location_text: parsed.data.location_text ?? null,
      location_type: (parsed.data.location_type ?? "hybrid") as LocationType,
      employment_type: (parsed.data.employment_type ??
        "regular") as EmploymentType,
      salary_display: parsed.data.salary_display ?? null,
      status,
      published_at: publishedAtForStatus(status, existing.published_at),
    })
    .eq("id", parsed.data.id);

  if (error) {
    return { ok: false, error: error.message ?? "Unable to update job post." };
  }

  const { logAudit } = await import("@/lib/audit/log");
  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: BEEPA_ORG_ID,
    action: "job_post.update",
    entityType: "job_post",
    entityId: parsed.data.id,
    before: {
      title: existing.title,
      slug: existing.slug,
      status: existing.status,
    },
    after: { title: parsed.data.title, slug: parsed.data.slug, status },
  });

  revalidatePath("/app/recruitment/jobs");
  revalidatePath(`/app/recruitment/jobs/${parsed.data.id}`);
  revalidatePath("/careers");
  revalidatePath(`/careers/${parsed.data.slug}`);
  if (existing.slug !== parsed.data.slug) {
    revalidatePath(`/careers/${existing.slug}`);
  }
  return { ok: true, message: "Job post updated." };
}

export async function closeJobPost(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  requirePermission(workspace, "recruitment.manage");

  const parsed = jobPostIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid job post." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("job_posts")
    .select("id, status, slug, published_at")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Job post not found." };
  }
  if (existing.status === "closed") {
    return { ok: true, message: "Job post is already closed." };
  }

  const { error } = await supabase
    .from("job_posts")
    .update({
      status: "closed",
      published_at: existing.published_at,
    })
    .eq("id", parsed.data.id);

  if (error) {
    return { ok: false, error: error.message ?? "Unable to close job post." };
  }

  const { logAudit } = await import("@/lib/audit/log");
  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: BEEPA_ORG_ID,
    action: "job_post.close",
    entityType: "job_post",
    entityId: parsed.data.id,
    before: { status: existing.status },
    after: { status: "closed" },
  });

  revalidatePath("/app/recruitment/jobs");
  revalidatePath(`/app/recruitment/jobs/${parsed.data.id}`);
  revalidatePath("/careers");
  revalidatePath(`/careers/${existing.slug}`);
  return { ok: true, message: "Job post closed." };
}

export async function publishJobPost(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  requirePermission(workspace, "recruitment.manage");

  const parsed = jobPostIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid job post." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("job_posts")
    .select("id, status, slug, published_at")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Job post not found." };
  }
  if (existing.status === "published") {
    return { ok: true, message: "Job post is already published." };
  }

  const { error } = await supabase
    .from("job_posts")
    .update({
      status: "published",
      published_at: existing.published_at ?? new Date().toISOString(),
    })
    .eq("id", parsed.data.id);

  if (error) {
    return { ok: false, error: error.message ?? "Unable to publish job post." };
  }

  const { logAudit } = await import("@/lib/audit/log");
  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: BEEPA_ORG_ID,
    action: "job_post.publish",
    entityType: "job_post",
    entityId: parsed.data.id,
    before: { status: existing.status },
    after: { status: "published" },
  });

  revalidatePath("/app/recruitment/jobs");
  revalidatePath(`/app/recruitment/jobs/${parsed.data.id}`);
  revalidatePath("/careers");
  revalidatePath(`/careers/${existing.slug}`);
  return { ok: true, message: "Job post published." };
}

export async function submitJobApplication(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "Sign in to apply for this role." };

  const parsed = jobApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Please check the form and try again.",
    };
  }

  const supabase = await createClient();

  let applicantId: string | null = null;
  const { data: existingApplicant } = await supabase
    .from("applicants")
    .select("id")
    .eq("profile_id", workspace.user.id)
    .maybeSingle();

  if (existingApplicant) {
    applicantId = existingApplicant.id;
    await supabase
      .from("applicants")
      .update({
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        linkedin_url: parsed.data.linkedin_url || null,
      })
      .eq("id", applicantId);
  } else {
    const { data: created, error: applicantError } = await supabase
      .from("applicants")
      .insert({
        profile_id: workspace.user.id,
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        linkedin_url: parsed.data.linkedin_url || null,
        source: "careers_site",
      })
      .select("id")
      .single();

    if (applicantError || !created) {
      return {
        ok: false,
        error: applicantError?.message ?? "Unable to create applicant profile.",
      };
    }
    applicantId = created.id;
  }

  const { data: existingApplication } = await supabase
    .from("job_applications")
    .select("id")
    .eq("applicant_id", applicantId)
    .eq("job_post_id", parsed.data.job_post_id)
    .maybeSingle();

  if (existingApplication) {
    return { ok: false, error: "You have already applied for this role." };
  }

  const { error: applicationError } = await supabase
    .from("job_applications")
    .insert({
      applicant_id: applicantId,
      job_post_id: parsed.data.job_post_id,
      notes: parsed.data.notes ?? null,
      stage: "applied",
    });

  if (applicationError) {
    return {
      ok: false,
      error: applicationError.message ?? "Unable to submit application.",
    };
  }

  revalidatePath("/app/applicant");
  revalidatePath(`/careers/${parsed.data.job_post_id}`);
  return { ok: true, message: "Application submitted." };
}

export async function updateApplicationStage(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  requirePermission(workspace, "recruitment.manage");

  const { applicationStageSchema } = await import("@/lib/validation/app");
  const parsed = applicationStageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid stage update." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("job_applications")
    .select("id, stage")
    .eq("id", parsed.data.application_id)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Application not found." };
  }

  const { error } = await supabase
    .from("job_applications")
    .update({ stage: parsed.data.stage })
    .eq("id", parsed.data.application_id);

  if (error) {
    return { ok: false, error: error.message ?? "Unable to update stage." };
  }

  await supabase.from("application_stage_history").insert({
    job_application_id: parsed.data.application_id,
    from_stage: existing.stage,
    to_stage: parsed.data.stage,
    changed_by: workspace.user.id,
    notes: parsed.data.notes ?? null,
  });

  const { logAudit } = await import("@/lib/audit/log");
  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: BEEPA_ORG_ID,
    action: "application.stage_update",
    entityType: "job_application",
    entityId: parsed.data.application_id,
    before: { stage: existing.stage },
    after: { stage: parsed.data.stage },
  });

  revalidatePath("/app/recruitment/applicants");
  revalidatePath(`/app/recruitment/applicants/${parsed.data.application_id}`);
  return { ok: true, message: "Stage updated." };
}

export async function convertApplicantToEmployee(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (
    !canAll(workspace.permissions, [
      "recruitment.manage",
      "employees.manage",
    ])
  ) {
    return {
      ok: false,
      error: "You need recruitment and employee manage permissions to hire.",
    };
  }

  const parsed = hireApplicantSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Invalid hire request.",
    };
  }

  const supabase = await createClient();
  const { data: application } = await supabase
    .from("job_applications")
    .select(
      "id, stage, applicant_id, applicants(id, profile_id, first_name, last_name, email), job_posts(title, employment_type)",
    )
    .eq("id", parsed.data.application_id)
    .maybeSingle();

  if (!application) {
    return { ok: false, error: "Application not found." };
  }

  const applicant = application.applicants as {
    id: string;
    profile_id: string | null;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  const job = application.job_posts as {
    title: string;
    employment_type: EmploymentType | null;
  } | null;

  if (!applicant?.email) {
    return { ok: false, error: "Applicant email is required to hire." };
  }

  const workEmail =
    (parsed.data.work_email && parsed.data.work_email.trim()) ||
    applicant.email;
  const hireDate =
    (parsed.data.hire_date && parsed.data.hire_date.trim()) ||
    new Date().toISOString().slice(0, 10);

  const admin = createAdminClient();

  if (applicant.profile_id) {
    const { data: existingEmployee } = await admin
      .from("employees")
      .select("id")
      .eq("profile_id", applicant.profile_id)
      .maybeSingle();
    if (existingEmployee) {
      if (application.stage !== "hired") {
        await supabase
          .from("job_applications")
          .update({ stage: "hired" })
          .eq("id", application.id);
        await supabase.from("application_stage_history").insert({
          job_application_id: application.id,
          from_stage: application.stage,
          to_stage: "hired",
          changed_by: workspace.user.id,
          notes: parsed.data.notes ?? "Already an employee; stage set to hired.",
        });
      }
      revalidatePath("/app/recruitment/applicants");
      revalidatePath(`/app/recruitment/applicants/${application.id}`);
      revalidatePath("/app/employees");
      return {
        ok: true,
        message: "Applicant already has an employee record.",
      };
    }
  }

  const authResolved = applicant.profile_id
    ? { userId: applicant.profile_id, invited: false as const }
    : await inviteOrResolveAuthUser(admin, {
        email: workEmail,
        firstName: applicant.first_name,
        lastName: applicant.last_name,
        redirectNext: "/employee/login",
      });
  if ("error" in authResolved) {
    return { ok: false, error: authResolved.error };
  }
  const { userId, invited } = authResolved;

  await admin
    .from("applicants")
    .update({ profile_id: userId })
    .eq("id", applicant.id);

  await admin
    .from("profiles")
    .update({
      first_name: applicant.first_name,
      last_name: applicant.last_name,
      display_name: `${applicant.first_name} ${applicant.last_name}`.trim(),
      status: invited ? "invited" : "active",
    })
    .eq("id", userId);

  const { data: role } = await admin
    .from("roles")
    .select("id")
    .eq("code", "employee")
    .single();
  if (!role) {
    return { ok: false, error: "Employee role is not configured." };
  }

  const { data: membership, error: membershipError } = await admin
    .from("organization_memberships")
    .upsert(
      {
        user_id: userId,
        organization_id: BEEPA_ORG_ID,
        membership_type: "internal",
        status: invited ? "invited" : "active",
        is_primary: true,
      },
      { onConflict: "organization_id,user_id" },
    )
    .select("id")
    .single();

  if (membershipError || !membership) {
    return {
      ok: false,
      error: membershipError?.message ?? "Unable to assign membership.",
    };
  }

  await admin.from("membership_roles").upsert(
    { membership_id: membership.id, role_id: role.id },
    { onConflict: "membership_id,role_id" },
  );

  let employeeNumber = `BEE-${Date.now().toString().slice(-5)}`;
  const { data: generated } = await admin.rpc("generate_employee_number");
  if (typeof generated === "string" && generated) employeeNumber = generated;

  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .insert({
      organization_id: BEEPA_ORG_ID,
      profile_id: userId,
      employee_number: employeeNumber,
      work_email: workEmail,
      personal_email: applicant.email,
      employment_status: "active",
      employment_type: (job?.employment_type ?? "regular") as EmploymentType,
      job_title: job?.title ?? "",
      hire_date: hireDate,
      default_timezone: "Asia/Manila",
    })
    .select("id")
    .single();

  if (employeeError || !employee) {
    return {
      ok: false,
      error: employeeError?.message ?? "Unable to create employee.",
    };
  }

  if (application.stage !== "hired") {
    const { error: stageError } = await supabase
      .from("job_applications")
      .update({ stage: "hired" })
      .eq("id", application.id);
    if (stageError) {
      return {
        ok: false,
        error: stageError.message ?? "Employee created but stage update failed.",
      };
    }
    await supabase.from("application_stage_history").insert({
      job_application_id: application.id,
      from_stage: application.stage,
      to_stage: "hired",
      changed_by: workspace.user.id,
      notes: parsed.data.notes ?? "Converted to employee.",
    });
  }

  const { logAudit } = await import("@/lib/audit/log");
  await logAudit(admin, {
    actorUserId: workspace.user.id,
    organizationId: BEEPA_ORG_ID,
    action: "application.hire_convert",
    entityType: "job_application",
    entityId: application.id,
    after: {
      employee_id: employee.id,
      profile_id: userId,
      invited,
      work_email: workEmail,
    },
  });

  revalidatePath("/app/recruitment/applicants");
  revalidatePath(`/app/recruitment/applicants/${application.id}`);
  revalidatePath("/app/employees");
  revalidatePath(`/app/employees/${employee.id}`);
  return {
    ok: true,
    message: invited
      ? "Employee created and invite email sent."
      : "Employee created and linked to existing account.",
  };
}
