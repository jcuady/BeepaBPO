import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceContext } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import type { Database, Json } from "@/types/database";

export type ApprovalWorkflowCode =
  | "leave"
  | "attendance_correction"
  | "cash_advance"
  | "payroll";

export type ApprovalStepRow = {
  id: string;
  step_order: number;
  role_code: string | null;
  permission_code: string | null;
  name: string;
};

export type ResolvedWorkflow = {
  id: string;
  code: string;
  name: string;
  entity_type: string;
  steps: ApprovalStepRow[];
};

type Db = SupabaseClient<Database>;

export async function resolveActiveWorkflow(
  supabase: Db,
  organizationId: string,
  code: ApprovalWorkflowCode,
): Promise<ResolvedWorkflow | null> {
  const { data: workflow } = await supabase
    .from("approval_workflows")
    .select("id, code, name, entity_type")
    .eq("organization_id", organizationId)
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();

  if (!workflow) return null;

  const { data: steps } = await supabase
    .from("approval_steps")
    .select("id, step_order, role_code, permission_code, name")
    .eq("workflow_id", workflow.id)
    .order("step_order", { ascending: true });

  return {
    id: workflow.id,
    code: workflow.code,
    name: workflow.name,
    entity_type: workflow.entity_type,
    steps: steps ?? [],
  };
}

export function canActOnApprovalStep(
  workspace: WorkspaceContext,
  step: ApprovalStepRow | undefined,
): boolean {
  if (!step) return false;
  if (step.permission_code && !can(workspace.permissions, step.permission_code)) {
    return false;
  }
  if (step.role_code) {
    const hasRole = workspace.memberships.some((m) =>
      m.roles.some((r) => r.code === step.role_code),
    );
    // Owners / system.manage can act on any step after permission check.
    if (!hasRole && !can(workspace.permissions, "system.manage")) {
      return false;
    }
  }
  return true;
}

export async function createApprovalRequest(
  supabase: Db,
  input: {
    organizationId: string;
    workflowCode: ApprovalWorkflowCode;
    entityType: string;
    entityId: string;
    requesterUserId: string;
    payload?: Record<string, unknown>;
  },
): Promise<{ ok: true; requestId: string } | { ok: false; error: string }> {
  const workflow = await resolveActiveWorkflow(
    supabase,
    input.organizationId,
    input.workflowCode,
  );
  if (!workflow) {
    return {
      ok: false,
      error: `No active “${input.workflowCode}” approval workflow for this organization.`,
    };
  }

  const { data, error } = await supabase
    .from("approval_requests")
    .insert({
      workflow_id: workflow.id,
      organization_id: input.organizationId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      requester_user_id: input.requesterUserId,
      current_step: 1,
      status: "pending",
      payload: (input.payload ?? {}) as Json,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Unable to create approval request.",
    };
  }

  return { ok: true, requestId: data.id };
}

export type AdvanceResult =
  | {
      ok: true;
      completed: boolean;
      approved: boolean;
      currentStep: number;
      nextStep: ApprovalStepRow | null;
      stepName: string;
    }
  | { ok: false; error: string };

/** Record approve/reject against the current workflow step. */
export async function advanceApprovalRequest(
  supabase: Db,
  workspace: WorkspaceContext,
  input: {
    entityType: string;
    entityId: string;
    action: "approve" | "reject";
    notes?: string | null;
  },
): Promise<AdvanceResult> {
  const { data: request } = await supabase
    .from("approval_requests")
    .select("id, workflow_id, current_step, status")
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .eq("status", "pending")
    .maybeSingle();

  if (!request) {
    return { ok: false, error: "Approval workflow not found." };
  }

  const { data: steps } = await supabase
    .from("approval_steps")
    .select("id, step_order, role_code, permission_code, name")
    .eq("workflow_id", request.workflow_id)
    .order("step_order", { ascending: true });

  const ordered = steps ?? [];
  const current =
    ordered.find((s) => s.step_order === request.current_step) ??
    ordered[request.current_step - 1];

  if (!canActOnApprovalStep(workspace, current)) {
    return {
      ok: false,
      error: current
        ? `You cannot act on step “${current.name}”.`
        : "Current approval step is not configured.",
    };
  }

  const { error: actionError } = await supabase.from("approval_actions").insert({
    request_id: request.id,
    step_order: request.current_step,
    actor_user_id: workspace.user.id,
    action: input.action,
    notes: input.notes ?? null,
  });

  if (actionError) {
    return {
      ok: false,
      error: actionError.message ?? "Unable to record approval action.",
    };
  }

  if (input.action === "reject") {
    const { error } = await supabase
      .from("approval_requests")
      .update({ status: "rejected" })
      .eq("id", request.id);
    if (error) {
      return { ok: false, error: error.message ?? "Unable to reject approval." };
    }
    return {
      ok: true,
      completed: true,
      approved: false,
      currentStep: request.current_step,
      nextStep: null,
      stepName: current?.name ?? `Step ${request.current_step}`,
    };
  }

  const next = ordered.find((s) => s.step_order > request.current_step) ?? null;
  if (next) {
    const { error } = await supabase
      .from("approval_requests")
      .update({ current_step: next.step_order })
      .eq("id", request.id);
    if (error) {
      return {
        ok: false,
        error: error.message ?? "Unable to advance approval step.",
      };
    }
    return {
      ok: true,
      completed: false,
      approved: false,
      currentStep: next.step_order,
      nextStep: next,
      stepName: current?.name ?? `Step ${request.current_step}`,
    };
  }

  const { error } = await supabase
    .from("approval_requests")
    .update({ status: "approved" })
    .eq("id", request.id);
  if (error) {
    return { ok: false, error: error.message ?? "Unable to complete approval." };
  }

  return {
    ok: true,
    completed: true,
    approved: true,
    currentStep: request.current_step,
    nextStep: null,
    stepName: current?.name ?? `Step ${request.current_step}`,
  };
}

export type EntityActability = {
  canAct: boolean;
  stepName: string | null;
  currentStep: number | null;
};

/** Batch: can the workspace act on each pending entity's current step? */
export async function mapPendingApprovalActability(
  supabase: Db,
  workspace: WorkspaceContext,
  entityType: string,
  entityIds: string[],
): Promise<Map<string, EntityActability>> {
  const result = new Map<string, EntityActability>();
  if (entityIds.length === 0) return result;

  const { data: requests } = await supabase
    .from("approval_requests")
    .select("entity_id, current_step, workflow_id")
    .eq("entity_type", entityType)
    .eq("status", "pending")
    .in("entity_id", entityIds);

  if (!requests?.length) return result;

  const workflowIds = [...new Set(requests.map((r) => r.workflow_id))];
  const { data: steps } = await supabase
    .from("approval_steps")
    .select(
      "id, workflow_id, step_order, role_code, permission_code, name",
    )
    .in("workflow_id", workflowIds)
    .order("step_order", { ascending: true });

  const stepsByWf = new Map<string, ApprovalStepRow[]>();
  for (const s of steps ?? []) {
    const list = stepsByWf.get(s.workflow_id) ?? [];
    list.push({
      id: s.id,
      step_order: s.step_order,
      role_code: s.role_code,
      permission_code: s.permission_code,
      name: s.name,
    });
    stepsByWf.set(s.workflow_id, list);
  }

  for (const req of requests) {
    const ordered = stepsByWf.get(req.workflow_id) ?? [];
    const current =
      ordered.find((s) => s.step_order === req.current_step) ??
      ordered[req.current_step - 1];
    result.set(req.entity_id, {
      canAct: canActOnApprovalStep(workspace, current),
      stepName: current?.name ?? null,
      currentStep: req.current_step,
    });
  }

  return result;
}
