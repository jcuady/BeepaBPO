import type { WorkspaceContext } from "@/lib/auth/workspace";
import type { ClientPortalFlags } from "@/lib/organizations/client-settings";

export type SerializedWorkspace = {
  userId: string;
  profile: {
    displayName: string;
    firstName: string;
    avatarUrl: string | null;
  };
  permissions: string[];
  isInternal: boolean;
  isClient: boolean;
  isApplicantOnly: boolean;
  roleLabel: string;
  organizationName: string | null;
  /** Present for client portal members; drives nav feature flags. */
  clientPortalFlags: ClientPortalFlags | null;
};

/** Prefer a named staff role over a generic Employee label when both exist. */
export function pickRoleLabel(
  roles: { code?: string | null; name: string }[] | undefined,
  fallback: string,
): string {
  if (!roles?.length) return fallback;
  return (
    roles.find((role) => role.code && role.code !== "employee")?.name ??
    roles[0].name
  );
}

export function serializeWorkspace(
  workspace: WorkspaceContext,
  clientPortalFlags: ClientPortalFlags | null = null,
): SerializedWorkspace {
  const primary = workspace.primaryMembership;
  const fallback = workspace.isClient
    ? "Client"
    : workspace.isInternal
      ? "Employee"
      : "Applicant";
  const roleLabel = pickRoleLabel(
    workspace.memberships.flatMap((m) => m.roles),
    fallback,
  );

  return {
    userId: workspace.user.id,
    profile: {
      displayName: workspace.profile.display_name || workspace.profile.first_name,
      firstName: workspace.profile.first_name || workspace.profile.display_name,
      avatarUrl: workspace.profile.avatar_url,
    },
    permissions: Array.from(workspace.permissions),
    isInternal: workspace.isInternal,
    isClient: workspace.isClient,
    isApplicantOnly: workspace.isApplicantOnly,
    roleLabel,
    organizationName: primary?.organization?.name ?? null,
    clientPortalFlags: workspace.isClient ? clientPortalFlags : null,
  };
}
