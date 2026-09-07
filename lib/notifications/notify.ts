import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";

export type NotifyUserParams = {
  userId: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
};

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

function getVapidConfig() {
  const env = getEnv();
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  return {
    publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  };
}

async function sendPushToUser(userId: string, payload: PushPayload) {
  const vapid = getVapidConfig();
  if (!vapid) return;

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) return;

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/app/my/notifications",
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushPayload,
        );
        await admin
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", sub.id);
      } catch (err: unknown) {
        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : null;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }),
  );
}

export async function notifyUser(params: NotifyUserParams) {
  const admin = createAdminClient();

  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("push_enabled, in_app_enabled")
    .eq("user_id", params.userId)
    .maybeSingle();

  const inAppEnabled = prefs?.in_app_enabled ?? true;
  const pushEnabled = prefs?.push_enabled ?? true;

  let notificationId: string | null = null;

  if (inAppEnabled) {
    const { data, error } = await admin
      .from("notifications")
      .insert({
        user_id: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        action_url: params.actionUrl ?? null,
        entity_type: params.entityType ?? null,
        entity_id: params.entityId ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;
    notificationId = data.id;
  }

  if (pushEnabled) {
    await sendPushToUser(params.userId, {
      title: params.title,
      body: params.body,
      url: params.actionUrl,
    });
  }

  return { notificationId };
}

export async function sendPushOnly(userId: string, payload: PushPayload) {
  const admin = createAdminClient();
  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("push_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (prefs && !prefs.push_enabled) return;
  await sendPushToUser(userId, payload);
}
