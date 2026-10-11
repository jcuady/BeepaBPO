"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { logAudit } from "@/lib/audit/log";
import { inviteOrResolveAuthUser } from "@/lib/auth/invite-user";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { runCronJobs } from "@/lib/jobs/cron-jobs";
import * as SELF_SERVICE_BASELINE from "@/lib/admin/role-assignment";
import { planFunctionalRoleChange, planInternalInviteRoles } from "@/lib/admin/role-assignment";
import { notifyUser } from "@/lib/notifications/notify";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  adminInviteSchema,
  adminMembershipRevokeSchema,
  adminMembershipRoleSchema,
} from "@/lib/validation/app";

export async function inviteInternalUser(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
  requirePermission(workspace, "system.manage");

  const parsed = adminInviteSchema.safeParse(input);
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

  // Resolved BEFORE the invite, same as `inviteClientUser`. It used to sit after
  // `inviteOrResolveAuthUser`, so a missing role row aborted the action only once
  // an auth user existed and an invitation had already been emailed.
  const { data: role } = await admin
    .from("roles")
    .select("id, code")
    .eq("code", parsed.data.role_code)
    .maybeSingle();
  if (!role) {
    return { ok: false, error: "Selected role is not configured." };
  }

  const authResolved = await inviteOrResolveAuthUser(admin, {
    email: parsed.data.email,
    firstName: parsed.data.first_name,
    lastName: parsed.data.last_name,
    redirectNext: "/employee/login",
  });
  if ("error" in authResolved) {
    return { ok: false, error: authResolved.error };
  }
  const { userId, invited } = authResolved;
  const displayName =
    `${parsed.data.first_name} ${parsed.data.last_name}`.trim();

  /**
   * Undo an account this action created, after the point of no return.
   *
   * Gated on `invited === true` for the same reason as the client path:
   * `invited: false` means `inviteOrResolveAuthUser` paged through `listUsers`
   * and matched somebody who already works here. Deleting that person's account
   * to tidy up a failed membership write is worse than the orphan this prevents.
   *
   * Deliberately NOT used at the self-service baseline step below: by then the
   * membership and its primary role exist, so the person can already sign in and
   * work. Rolling back there would destroy a usable account over a missing
   * convenience role.
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
    await rollbackCreatedUser();
    return { ok: false, error: "Unable to assign membership." };
  }

  const { error: roleError } = await admin.from("membership_roles").upsert(
    { membership_id: membership.id, role_id: role.id },
    { onConflict: "membership_id,role_id" },
  );
  if (roleError) {
    await rollbackCreatedUser();
    return { ok: false, error: "Unable to assign the selected role." };
  }

  // Give them the same self-service baseline every other staff member has.
  //
  // Without this, inviting somebody as, say, HR produced a membership holding
  // `[hr]` alone — so the person they had just hired could not open their own
  // leave, payslips, attendance or tickets, and would only discover it after
  // signing in. The seeds grant this baseline; the invite path did not.
  let baselinePreserved = false;
  const wantedCodes = planInternalInviteRoles(role.code);
  if (wantedCodes.length > 1) {
    const { data: wantedRoles } = await admin
      .from("roles")
      .select("id, code")
      .in("code", wantedCodes);
    for (const r of wantedRoles ?? []) {
      const { error: baselineError } = await admin.from("membership_roles").upsert(
        { membership_id: membership.id, role_id: r.id },
        { onConflict: "membership_id,role_id" },
      );
      if (baselineError) {
        // No rollback here, unlike the three failures above. Membership and the
        // primary role are already written, so the invited person can sign in and
        // work; removing the account over a missing self-service role would be a
        // far worse outcome than the incomplete grant.
        return { ok: false, error: "Unable to grant self-service access." };
      }
      if (r.code === SELF_SERVICE_BASELINE_ROLE_CODE) baselinePreserved = true;
    }
  }

  await logAudit(admin, {
    actorUserId: workspace.user.id,
    organizationId: BEEPA_ORG_ID,
    action: "users.invite",
    entityType: "organization_membership",
    entityId: membership.id,
    after: {
      user_id: userId,
      email: parsed.data.email,
      role_code: role.code,
      self_service_baseline: baselinePreserved,
      invited,
    },
  });

  revalidatePath("/app/admin/users");
  revalidatePath("/app/admin");
  return {
    ok: true,
    message: invited
      ? `Invite sent to ${parsed.data.email}.`
      : `Existing user linked with role ${role.code}.`,
  };
}

export async function runCronDryRun(): Promise<
  ActionResult & { results?: Record<string, number> }
> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
  requirePermission(workspace, "system.manage");

  const result = await runCronJobs({ job: "all", dryRun: true });

  await logAudit(createAdminClient(), {
    actorUserId: workspace.user.id,
    organizationId: BEEPA_ORG_ID,
    action: "jobs.cron_dry_run",
    entityType: "cron",
    after: result.results,
  });

  return {
    ok: true,
    message: `Dry-run OK — missing clock-out: ${result.results.missing_clock_out ?? 0}, overdue invoices: ${result.results.invoice_overdue ?? 0}, digests: ${result.results.notification_digest ?? 0}.`,
    results: result.results,
  };
}

export async function sendAdminTestPush(): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
  requirePermission(workspace, "system.manage");

  try {
    await notifyUser({
      userId: workspace.user.id,
      type: "system.test",
      title: "Beepa test notification",
      body: "Push and in-app delivery check from Admin.",
      actionUrl: "/app/my/notifications",
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send test notification.",
    };
  }

  await logAudit(createAdminClient(), {
    actorUserId: workspace.user.id,
    organizationId: BEEPA_ORG_ID,
    action: "push.test",
    entityType: "notification",
    after: { user_id: workspace.user.id },
  });

  return {
    ok: true,
    message: "Test notification sent to your account (in-app; push if subscribed).",
  };
}

const PROTECTED_ROLE_CODES = new Set(["owner", "super_admin"]);

/**
 * The self-service baseline — see `lib/admin/role-assignment.ts` for the rule
 * and why replacing every role was destroying a person's access to their own
 * leave, payslips, attendance and tickets.
 */
const { SELF_SERVICE_BASELINE_ROLE_CODE } = SELF_SERVICE_BASELINE;

async function loadMembershipForAdmin(membershipId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_memberships")
    .select(
      "id, status, membership_type, organization_id, user_id, membership_roles(role_id, roles(code, name))",
    )
    .eq("id", membershipId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return { admin, membership: data };
}

function membershipHasProtectedRole(
  membership: {
    membership_roles:
      | { role_id?: string | null; roles: { code: string; name: string } | null }[]
      | null;
  } | null,
) {
  const codes =
    membership?.membership_roles
      ?.map((mr) => mr.roles?.code)
      .filter(Boolean) ?? [];
  return codes.some((code) => PROTECTED_ROLE_CODES.has(code as string));
}

export async function updateInternalMembershipRole(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
  requirePermission(workspace, "system.manage");

  const parsed = adminMembershipRoleSchema.safeParse(input);
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

  const { admin, membership } = await loadMembershipForAdmin(
    parsed.data.membership_id,
  );
  if (!membership) {
    return { ok: false, error: "Membership not found." };
  }
  if (membership.membership_type !== "internal") {
    return {
      ok: false,
      error: "Only internal Beepa memberships can change roles here.",
    };
  }
  if (membershipHasProtectedRole(membership)) {
    return {
      ok: false,
      error: "Owner and Super Admin roles cannot be changed here.",
    };
  }

  const { data: role } = await admin
    .from("roles")
    .select("id, code")
    .eq("code", parsed.data.role_code)
    .maybeSingle();
  if (!role) {
    return { ok: false, error: "Selected role is not configured." };
  }

  const beforeCodes =
    membership.membership_roles
      ?.map((mr) => mr.roles?.code)
      .filter(Boolean) ?? [];

  // Replace the FUNCTIONAL role only. `planFunctionalRoleChange` holds the
  // rule; see lib/admin/role-assignment.ts for why replacing every role was
  // stripping a person's own leave, payslips, attendance and tickets.
  const plan = planFunctionalRoleChange(beforeCodes, role.code);

  const preservedRoleIds = (membership.membership_roles ?? [])
    .filter((mr) => plan.preserved.includes(mr.roles?.code ?? ""))
    .map((mr) => mr.role_id)
    .filter((id): id is string => Boolean(id));

  const doomedRoleIds = (membership.membership_roles ?? [])
    .map((mr) => mr.role_id)
    .filter((id): id is string => Boolean(id) && !preservedRoleIds.includes(id as string));

  if (doomedRoleIds.length) {
    await admin
      .from("membership_roles")
      .delete()
      .eq("membership_id", membership.id)
      .in("role_id", doomedRoleIds);
  }

  // upsert rather than insert: changing to the role the member already holds
  // would otherwise trip the unique constraint after the delete above.
  const { error: roleError } = await admin.from("membership_roles").upsert(
    { membership_id: membership.id, role_id: role.id },
    { onConflict: "membership_id,role_id" },
  );
  if (roleError) {
    return {
      ok: false,
      error: roleError.message ?? "Unable to update role.",
    };
  }

  await logAudit(admin, {
    actorUserId: workspace.user.id,
    organizationId: membership.organization_id,
    action: "users.role_change",
    entityType: "organization_membership",
    entityId: membership.id,
    before: { role_codes: beforeCodes },
    after: { role_codes: plan.result },
  });

  revalidatePath("/app/admin/users");
  return {
    ok: true,
    message: plan.preserved.length
      ? `Role updated to ${role.code}. Self-service access kept.`
      : `Role updated to ${role.code}.`,
  };
}

export async function revokeMembership(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
  requirePermission(workspace, "system.manage");

  const parsed = adminMembershipRevokeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Invalid membership.",
    };
  }

  const { admin, membership } = await loadMembershipForAdmin(
    parsed.data.membership_id,
  );
  if (!membership) {
    return { ok: false, error: "Membership not found." };
  }
  if (membershipHasProtectedRole(membership)) {
    return {
      ok: false,
      error: "Owner and Super Admin memberships cannot be revoked here.",
    };
  }
  if (membership.user_id === workspace.user.id) {
    return { ok: false, error: "You cannot revoke your own membership." };
  }

  const { error } = await admin
    .from("organization_memberships")
    .update({ status: "inactive" })
    .eq("id", membership.id);

  if (error) {
    return {
      ok: false,
      error: error.message ?? "Unable to revoke membership.",
    };
  }

  await logAudit(admin, {
    actorUserId: workspace.user.id,
    organizationId: membership.organization_id,
    action: "users.revoke",
    entityType: "organization_membership",
    entityId: membership.id,
    before: { status: membership.status },
    after: { status: "inactive" },
  });

  revalidatePath("/app/admin/users");
  return { ok: true, message: "Membership revoked." };
}
