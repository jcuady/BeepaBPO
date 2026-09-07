"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { logAudit } from "@/lib/audit/log";
import { inviteOrResolveAuthUser } from "@/lib/auth/invite-user";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientInviteSchema } from "@/lib/validation/app";

export async function inviteClientUser(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  requirePermission(workspace, "clients.manage");

  const parsed = clientInviteSchema.safeParse(input);
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

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id, name, type, status")
    .eq("id", parsed.data.organization_id)
    .maybeSingle();

  if (!org || org.type !== "client") {
    return { ok: false, error: "Select a client organization." };
  }
  if (org.status !== "active") {
    return { ok: false, error: "That client organization is not active." };
  }

  const authResolved = await inviteOrResolveAuthUser(admin, {
    email: parsed.data.email,
    firstName: parsed.data.first_name,
    lastName: parsed.data.last_name,
    redirectNext: "/app/client",
  });
  if ("error" in authResolved) {
    return { ok: false, error: authResolved.error };
  }
  const { userId, invited } = authResolved;
  const displayName =
    `${parsed.data.first_name} ${parsed.data.last_name}`.trim();

  await admin
    .from("profiles")
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      display_name: displayName,
      status: invited ? "invited" : "active",
    })
    .eq("id", userId);

  const { data: role } = await admin
    .from("roles")
    .select("id, code")
    .eq("code", parsed.data.role_code)
    .eq("scope", "client")
    .maybeSingle();
  if (!role) {
    return { ok: false, error: "Selected client role is not configured." };
  }

  const { data: membership, error: membershipError } = await admin
    .from("organization_memberships")
    .upsert(
      {
        user_id: userId,
        organization_id: org.id,
        membership_type: "client",
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

  const { error: roleError } = await admin.from("membership_roles").upsert(
    { membership_id: membership.id, role_id: role.id },
    { onConflict: "membership_id,role_id" },
  );
  if (roleError) {
    return {
      ok: false,
      error: roleError.message ?? "Unable to assign role.",
    };
  }

  await logAudit(admin, {
    actorUserId: workspace.user.id,
    organizationId: BEEPA_ORG_ID,
    action: "clients.invite",
    entityType: "organization_membership",
    entityId: membership.id,
    after: {
      user_id: userId,
      email: parsed.data.email,
      role_code: role.code,
      client_organization_id: org.id,
      invited,
    },
  });

  revalidatePath("/app/clients");
  revalidatePath("/app/admin/organizations");
  return {
    ok: true,
    message: invited
      ? `Invite sent to ${parsed.data.email} for ${org.name}.`
      : `Existing user linked to ${org.name} as ${role.code}.`,
  };
}
