"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { logAudit } from "@/lib/audit/log";
import { inviteOrResolveAuthUser } from "@/lib/auth/invite-user";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { runCronJobs } from "@/lib/jobs/cron-jobs";
import { notifyUser } from "@/lib/notifications/notify";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminInviteSchema } from "@/lib/validation/app";

export async function inviteInternalUser(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
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
    .maybeSingle();
  if (!role) {
    return { ok: false, error: "Selected role is not configured." };
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
    action: "users.invite",
    entityType: "organization_membership",
    entityId: membership.id,
    after: {
      user_id: userId,
      email: parsed.data.email,
      role_code: role.code,
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
