"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { logAudit } from "@/lib/audit/log";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { nteCaseSchema, nteResponseSchema, nteResolveSchema } from "@/lib/validation/app";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { naiveDateTimeToZoned } from "@/lib/attendance/corrected-times";
import { DEFAULT_TIMEZONE } from "@/lib/attendance/zoned-time";
import { writeFailed } from "@/lib/actions/error-copy";

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

  // `response_due_at` arrives from a `datetime-local` input as a naive
  // "YYYY-MM-DDTHH:mm". Postgres casts a bare timestamp as UTC wherever the app
  // runs, so storing one unchanged puts an Asia/Manila deadline eight hours out, and
  // the employee is shown the shifted date. Measured on the demo tenant: HR set a
  // deadline of 17:00 on 9 March, the row stored `17:00Z`, and /app/my/nte rendered
  // "Due Mar 10, 2026" — a day later than the day HR typed.
  //
  // Convert to a real instant in the employee's own timezone first, the same rule
  // the attendance manual-entry and correction paths already use. Falling back to the
  // raw value keeps the previous behaviour for an unparseable string rather than
  // silently storing something else.
  const { data: employeeRow } = await supabase
    .from("employees")
    .select("default_timezone")
    .eq("id", parsed.data.employee_id)
    .maybeSingle();
  const timeZone = employeeRow?.default_timezone || DEFAULT_TIMEZONE;
  const responseDueAt =
    naiveDateTimeToZoned(parsed.data.response_due_at, timeZone) ??
    (parsed.data.response_due_at || null);

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
      response_due_at: responseDueAt,
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

  // Both halves go through one SECURITY DEFINER function rather than an insert here
  // and an update there.
  //
  // The insert half alone always worked: the employee holds `nte.self`, and
  // `nte_responses_insert` permits exactly that. The update half never did --
  // `nte_cases_manage` is gated on `nte.manage`, which an employee deliberately does
  // not hold, so RLS rejected it. The error was never read, so the action returned
  // "Response submitted." while the case stayed at `issued`. Measured on the demo
  // tenant: response text stored, status unchanged, employee told it was filed.
  //
  // The alternative -- a `for update` policy on `is_self_employee(employee_id)` --
  // is worse than the bug, because RLS cannot restrict columns: it would let an
  // employee resolve their own Notice to Explain. Migration
  // 20261010120000_nte_response_submission.sql keeps the write narrow instead.
  const { data: newStatus, error } = await supabase.rpc("submit_nte_response", {
    p_nte_case_id: parsed.data.nte_case_id,
    p_response_text: parsed.data.response_text,
  });

  if (error) {
    // The three failure modes are distinct and the caller needs to tell them apart:
    // a case that is not the employee's, a case already resolved, and a short body
    // are three different conversations.
    if (error.message.includes("NTE_NOT_FOUND_OR_NOT_OWNED")) {
      return { ok: false, error: "NTE case not found." };
    }
    if (error.message.includes("CASE_NOT_OPEN")) {
      return {
        ok: false,
        error: "This case is no longer awaiting a response.",
      };
    }
    if (error.message.includes("EMPTY_RESPONSE")) {
      return {
        ok: false,
        fieldErrors: { response_text: ["Response is required."] },
        error: "Please check the form and try again.",
      };
    }
    return { ok: false, error: writeFailed("Unable to submit response.") };
  }

  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: workspace.primaryMembership?.organization_id,
    action: "nte.respond",
    entityType: "nte_case",
    entityId: parsed.data.nte_case_id,
    after: { status: newStatus ?? "under_review" },
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
        error: writeFailed("Unable to save disciplinary action."),
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
    return { ok: false, error: writeFailed("Unable to resolve NTE case.") };
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
