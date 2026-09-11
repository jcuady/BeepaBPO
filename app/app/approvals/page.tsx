import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { PageContainer } from "@/components/app/page-container";
import { resolveWorkspace, requireAnyPermission, requireInternal } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  canActOnApprovalStep,
  type ApprovalStepRow,
} from "@/lib/approvals/engine";

type ReviewTarget = {
  href: string;
  label: string;
  available: boolean;
};

function reviewTarget(
  entityType: string,
  entityId: string,
  permissions: Set<string>,
): ReviewTarget {
  switch (entityType) {
    case "leave_request":
      return {
        href: "/app/leave",
        label: "Open leave queue",
        available: permissions.has("leave.approve"),
      };
    case "cash_advance":
    case "cash_advance_request":
      return {
        href: "/app/cash-advances",
        label: "Open cash advances",
        available:
          permissions.has("cash_advance.read") ||
          permissions.has("cash_advance.approve") ||
          permissions.has("cash_advance.manage"),
      };
    case "ticket":
      return {
        href: `/app/tickets/${entityId}`,
        label: "Open ticket",
        available: permissions.has("tickets.read"),
      };
    case "attendance_correction":
      return {
        href: "/app/attendance/corrections",
        label: "Open corrections queue",
        available:
          permissions.has("attendance.approve") ||
          permissions.has("attendance.correct") ||
          permissions.has("attendance.manage"),
      };
    case "payroll_period":
      return {
        href: `/app/payroll/periods/${entityId}`,
        label: "Open payroll period",
        available:
          permissions.has("payroll.read") ||
          permissions.has("payroll.manage") ||
          permissions.has("payroll.approve"),
      };
    default:
      return {
        href: "/app/my/requests",
        label: "View my requests",
        available: true,
      };
  }
}

export default async function ApprovalsPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  // Match admin nav — not every employee with approvals.act.
  requireAnyPermission(workspace, [
    "leave.approve",
    "cash_advance.approve",
    "cash_advance.manage",
    "attendance.approve",
    "attendance.correct",
    "attendance.manage",
    "payroll.manage",
    "payroll.approve",
  ]);

  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("approval_requests")
    .select("id, entity_type, entity_id, status, created_at, current_step, workflow_id, payload")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  const workflowIds = [
    ...new Set((requests ?? []).map((r) => r.workflow_id).filter(Boolean)),
  ];
  const { data: steps } =
    workflowIds.length > 0
      ? await supabase
          .from("approval_steps")
          .select(
            "id, workflow_id, step_order, role_code, permission_code, name",
          )
          .in("workflow_id", workflowIds)
          .order("step_order", { ascending: true })
      : { data: [] as never[] };

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

  const name =
    workspace.profile?.display_name ||
    workspace.profile?.first_name ||
    "there";

  return (
    <PageContainer>
      <PageHeader
        name={name}
        subtitle="Pending items. Review opens the queue you can act on."
      />
      {!requests?.length ? (
        <EmptyState
          title="No pending approvals"
          description="When teammates submit requests, they will show up here."
        />
      ) : (
        <ul className="divide-y divide-line rounded-[16px] border border-line bg-white">
          {requests.map((req) => {
            const ordered = stepsByWf.get(req.workflow_id) ?? [];
            const current =
              ordered.find((s) => s.step_order === req.current_step) ??
              ordered[req.current_step - 1];
            const canAct = canActOnApprovalStep(workspace, current);
            const target = reviewTarget(
              req.entity_type,
              req.entity_id,
              workspace.permissions,
            );
            const showReview = canAct && target.available;
            return (
              <li
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"
              >
                <div>
                  <p className="font-display text-sm font-semibold text-navy">
                    {req.entity_type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-slate">
                    {new Date(req.created_at).toLocaleString()}
                    {current?.name ? ` · Step: ${current.name}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={req.status} />
                  {showReview ? (
                    <Link
                      href={target.href}
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-green-strong hover:underline"
                    >
                      {target.label}
                    </Link>
                  ) : (
                    <span className="text-xs text-slate">
                      {current?.name
                        ? `Waiting for ${current.name}`
                        : target.label}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
