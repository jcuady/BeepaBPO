"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { logAudit } from "@/lib/audit/log";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { nteCaseSchema, nteResponseSchema, nteResolveSchema } from "@/lib/validation/app";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";

function caseNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  return `NTE-${stamp}`;
}

export async function createNteCase(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!can(workspace.permissions, "nte.manage")) {
    return { ok: false, error: "You do not have permission to create NTE cases." };
  }

  const parsed = nteCaseSchema.safeParse(input);
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
  const { data: created, error } = await supabase
    .from("nte_cases")
    .insert({
      employee_id: parsed.data.employee_id,
      case_number: caseNumber(),
      incident_date: parsed.data.incident_date,
      incident_type: parsed.data.incident_type,
      subject: parsed.data.subject,
      description: parsed.data.description,
      issued_by: workspace.user.id,
      issued_at: new Date().toISOString(),
      response_due_at: parsed.data.response_due_at || null,
      status: "issued",
    })
    .select("id, case_number")
    .single();

  if (error || !created) {
    return { ok: false, error: error?.message ?? "Unable to create NTE case." };
  }

  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: workspace.primaryMembership?.organization_id,
    action: "nte.create",
    entityType: "nte_case",
    entityId: created.id,
    after: { case_number: created.case_number, status: "issued" },
  });

  revalidatePath("/app/hr/nte");
  revalidatePath("/app/my/nte");
  return { ok: true, message: `NTE ${created.case_number} created.` };
}

export async function submitNteResponse(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!can(workspace.permissions, "nte.self")) {
    return { ok: false, error: "You do not have permission to respond." };
  }

  const parsed = nteResponseSchema.safeParse(input);
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

  const employee = await resolveEmployeeForUser(workspace.user.id);
  if (!employee) return { ok: false, error: "Employee record not found." };

  const supabase = await createClient();
  const { data: nteCase } = await supabase
    .from("nte_cases")
    .select("id, employee_id, status")
    .eq("id", parsed.data.nte_case_id)
    .maybeSingle();

  if (!nteCase || nteCase.employee_id !== employee.id) {
    return { ok: false, error: "NTE case not found." };
  }

  const { error } = await supabase.from("nte_responses").insert({
    nte_case_id: parsed.data.nte_case_id,
    employee_id: employee.id,
    response_text: parsed.data.response_text,
  });

  if (error) {
    return { ok: false, error: error.message ?? "Unable to submit response." };
  }

  await supabase
    .from("nte_cases")
    .update({ status: "under_review" })
    .eq("id", parsed.data.nte_case_id);

  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: workspace.primaryMembership?.organization_id,
    action: "nte.respond",
    entityType: "nte_case",
    entityId: parsed.data.nte_case_id,
    after: { status: "under_review" },
  });

  revalidatePath("/app/my/nte");
  revalidatePath("/app/hr/nte");
  return { ok: true, message: "Response submitted." };
}

const OPEN_NTE_STATUSES = new Set([
  "issued",
  "awaiting_response",
  "under_review",
]);

export async function resolveNteCase(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!can(workspace.permissions, "nte.manage")) {
    return { ok: false, error: "You do not have permission to resolve NTE cases." };
  }

  const parsed = nteResolveSchema.safeParse(input);
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
  const { data: nteCase } = await supabase
    .from("nte_cases")
    .select("id, status, case_number")
    .eq("id", parsed.data.nte_case_id)
    .maybeSingle();

  if (!nteCase) {
    return { ok: false, error: "NTE case not found." };
  }
  if (!OPEN_NTE_STATUSES.has(nteCase.status)) {
    return {
      ok: false,
      error: `Case ${nteCase.case_number} cannot be resolved from status “${nteCase.status}”.`,
    };
  }

  const now = new Date().toISOString();

  if (parsed.data.resolution_type !== "cleared") {
    const effective =
      parsed.data.effective_date?.trim() || now.slice(0, 10);
    const { error: disciplineError } = await supabase
      .from("disciplinary_actions")
      .insert({
        nte_case_id: parsed.data.nte_case_id,
        action_type: parsed.data.resolution_type,
        effective_date: effective,
        notes: parsed.data.resolution_notes,
        created_by: workspace.user.id,
      });
    if (disciplineError) {
      return {
        ok: false,
        error:
          disciplineError.message ??
          "Unable to save disciplinary action.",
      };
    }
  }

  const { error } = await supabase
    .from("nte_cases")
    .update({
      status: "resolved",
      resolution_type: parsed.data.resolution_type,
      resolution_notes: parsed.data.resolution_notes,
      resolved_by: workspace.user.id,
      resolved_at: now,
    })
    .eq("id", parsed.data.nte_case_id)
    .neq("status", "resolved");

  if (error) {
    return { ok: false, error: error.message ?? "Unable to resolve NTE case." };
  }

  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: workspace.primaryMembership?.organization_id,
    action: "nte.resolve",
    entityType: "nte_case",
    entityId: parsed.data.nte_case_id,
    before: { status: nteCase.status },
    after: {
      status: "resolved",
      resolution_type: parsed.data.resolution_type,
    },
  });

  revalidatePath("/app/hr/nte");
  revalidatePath("/app/my/nte");
  return {
    ok: true,
    message: `NTE ${nteCase.case_number} resolved.`,
  };
}
