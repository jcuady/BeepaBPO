"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspace } from "@/lib/auth/workspace";

export type NotificationActionResult = {
  ok: boolean;
  error?: string;
};

export async function markNotificationRead(
  notificationId: string,
): Promise<NotificationActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", workspace.user.id)
    .is("read_at", null);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/app");
  revalidatePath("/app/my/notifications");
  return { ok: true };
}

export async function markAllRead(): Promise<NotificationActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", workspace.user.id)
    .is("read_at", null);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/app");
  revalidatePath("/app/my/notifications");
  return { ok: true };
}

export async function updateNotificationPreferences(prefs: {
  in_app_enabled?: boolean;
  push_enabled?: boolean;
  email_enabled?: boolean;
}): Promise<NotificationActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: workspace.user.id,
      ...prefs,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/my/notifications");
  return { ok: true };
}
