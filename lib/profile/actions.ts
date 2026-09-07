"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { profileUpdateSchema } from "@/lib/validation/app";

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };

  const parsed = profileUpdateSchema.safeParse(input);
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
  const before = {
    display_name: workspace.profile.display_name,
    phone: workspace.profile.phone,
    timezone: workspace.profile.timezone,
  };

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.display_name,
      phone: parsed.data.phone || null,
      timezone: parsed.data.timezone,
    })
    .eq("id", workspace.user.id);

  if (error) {
    return { ok: false, error: error.message ?? "Unable to update profile." };
  }

  const { logAudit } = await import("@/lib/audit/log");
  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: workspace.primaryMembership?.organization_id,
    action: "profile.update",
    entityType: "profile",
    entityId: workspace.user.id,
    before,
    after: {
      display_name: parsed.data.display_name,
      phone: parsed.data.phone || null,
      timezone: parsed.data.timezone,
    },
  });

  revalidatePath("/app/my/profile");
  revalidatePath("/app/applicant/profile");
  return { ok: true, message: "Profile updated." };
}
