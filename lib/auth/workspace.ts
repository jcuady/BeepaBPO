import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { forbidden } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, canAny, canAll } from "@/lib/permissions/can";
import type { PermissionCode } from "@/lib/permissions/codes";
import type { Tables } from "@/types/database";
import { computeWorkspaceFlags } from "@/lib/auth/workspace-flags";

export type MembershipWithOrg = Tables<"organization_memberships"> & {
  organization: Tables<"organizations">;
  roles: Tables<"roles">[];
};

export type WorkspaceContext = {
  user: User;
  profile: Tables<"profiles">;
  memberships: MembershipWithOrg[];
  permissions: Set<string>;
  primaryMembership: MembershipWithOrg | null;
  isInternal: boolean;
  isClient: boolean;
  isApplicantOnly: boolean;
};

/** One resolution per request — shared by layout, segment layouts, and pages. */
export const resolveWorkspace = cache(
  async (): Promise<WorkspaceContext | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) return null;

    const { data: membershipsRaw } = await supabase
      .from("organization_memberships")
      .select(
        `
      *,
      organization:organizations (*),
      membership_roles (
        roles (*)
      )
    `,
      )
      .eq("user_id", user.id)
      .eq("status", "active");

    const memberships: MembershipWithOrg[] = (membershipsRaw ?? []).map(
      (row) => {
        const { organization, membership_roles, ...membership } = row;
        const membershipRoles = membership_roles as
          | { roles: Tables<"roles"> }[]
          | null;
        return {
          ...membership,
          organization: organization as Tables<"organizations">,
          roles: (membershipRoles ?? []).map((mr) => mr.roles),
        };
      },
    );

    const { data: permissionCodes } = await supabase.rpc(
      "user_permission_codes",
    );
    const permissions = new Set<string>(permissionCodes ?? []);

    const primaryMembership =
      memberships.find((m) => m.is_primary) ??
      memberships.find(
        (m) =>
          m.membership_type === "internal" &&
          m.organization.type === "internal",
      ) ??
      memberships[0] ??
      null;

    const { isInternal, isClient, isApplicantOnly } =
      computeWorkspaceFlags(memberships);

    return {
      user,
      profile,
      memberships,
      permissions,
      primaryMembership,
      isInternal,
      isClient,
      isApplicantOnly,
    };
  },
);

export function requirePermission(
  workspace: WorkspaceContext,
  code: PermissionCode | string,
): void {
  if (!can(workspace.permissions, code)) forbidden();
}

/** Staff-only surfaces (CRM ops, tickets queue, reports, billing hub). */
export function requireInternal(workspace: WorkspaceContext): void {
  if (!workspace.isInternal) forbidden();
}

export function requireAnyPermission(
  workspace: WorkspaceContext,
  codes: readonly string[],
): void {
  if (!canAny(workspace.permissions, codes)) forbidden();
}

export function requireAllPermissions(
  workspace: WorkspaceContext,
  codes: readonly string[],
): void {
  if (!canAll(workspace.permissions, codes)) forbidden();
}
