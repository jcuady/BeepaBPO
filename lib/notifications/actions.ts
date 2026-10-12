"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { writeFailed } from "@/lib/actions/error-copy";

export type NotificationActionResult = {
  ok: boolean;
  error?: string;
};

export async function markNotificationRead(
  notificationId: string,
): Promise<NotificationActionResult> {
  // rls-gated: notifications_update_own restricts to auth.uid() == user_id.
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", workspace.user.id)
    .is("read_at", null);

  // There was no `?? "copy"` fallback here — this returned the driver's message
  // outright, making it the rawest of the three shapes the sweep found. The copy
  // below is new; there was none here to recover.
  if (error) return { ok: false, error: writeFailed("Unable to mark that notification as read.") };

  revalidatePath("/app");
  revalidatePath("/app/my/notifications");
  return { ok: true };
}

export async function markAllRead(): Promise<NotificationActionResult> {
  // rls-gated: notifications_update_own restricts to auth.uid() == user_id.
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", workspace.user.id)
    .is("read_at", null);

  if (error) return { ok: false, error: writeFailed("Unable to mark all notifications as read.") };

  revalidatePath("/app");
  revalidatePath("/app/my/notifications");
  return { ok: true };
}

export async function updateNotificationPreferences(prefs: {
  // rls-gated: notification_preferences row belongs to the calling user.
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

  if (error) return { ok: false, error: writeFailed("Unable to update your notification preferences.") };

  revalidatePath("/app/my/notifications");
  return { ok: true };
}
