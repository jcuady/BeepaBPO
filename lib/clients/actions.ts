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
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
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

  // Resolved BEFORE anything irreversible happens. This is a cheap local read,
  // and it used to sit after `inviteOrResolveAuthUser` — so a missing or
  // mis-seeded `client_admin` row aborted the action only once an auth user
  // existed and an invitation had been emailed to a real address. The admin was
  // told "role is not configured" and left holding an orphan.
  const { data: role } = await admin
    .from("roles")
    .select("id, code")
    .eq("code", parsed.data.role_code)
    .eq("scope", "client")
    .maybeSingle();
  if (!role) {
    return { ok: false, error: "Selected client role is not configured." };
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

  /**
   * Undo the account this action created, after the point of no return.
   *
   * The gate is the whole safety argument and it is not negotiable.
   * `inviteOrResolveAuthUser` returns `invited: false` when it paged through
   * `listUsers` and matched a colleague who already had an account. Rolling back
   * on that path would delete a real person's login to tidy up a failed
   * membership write — a far worse outcome than the orphan this prevents. So we
   * only ever remove an account we ourselves created moments ago.
   *
   * The invitation email has already been sent and cannot be recalled, so a
   * rollback leaves the recipient holding a link to an account that no longer
   * exists. That is the correct trade: the alternative is an account that signs
   * in to nothing, with a membership that was never written.
   */
  const rollbackCreatedUser = async () => {
    if (invited === true) {
      await admin.auth.admin.deleteUser(userId);
    }
  };

  // Result was previously discarded, so a failed profile update still reported
  // success and left a provisioned user with no name.
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      display_name: displayName,
      status: invited ? "invited" : "active",
    })
    .eq("id", userId);

  if (profileError) {
    await rollbackCreatedUser();
    return {
      ok: false,
      error: "Unable to set up the invited user's profile.",
    };
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
    await rollbackCreatedUser();
    return { ok: false, error: "Unable to assign membership." };
  }

  const { error: roleError } = await admin.from("membership_roles").upsert(
    { membership_id: membership.id, role_id: role.id },
    { onConflict: "membership_id,role_id" },
  );
  if (roleError) {
    await rollbackCreatedUser();
    return { ok: false, error: "Unable to assign the portal role." };
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
