import type { WorkspaceContext } from "@/lib/auth/workspace";

export function getClientOrganizationId(
  workspace: WorkspaceContext,
): string | null {
  const membership =
    workspace.memberships.find((m) => m.membership_type === "client") ?? null;
  return membership?.organization_id ?? null;
}
