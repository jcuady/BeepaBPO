import { createAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/email/send";

const DIGEST_COOLDOWN_MS = 20 * 60 * 60 * 1000; // ~once per day
const MAX_USERS = 100;
const MAX_ITEMS = 15;

export type DigestRunResult = {
  candidates: number;
  sent: number;
  skipped: number;
  failed: number;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Email unread in-app notifications for users with email digests enabled. */
export async function runNotificationEmailDigest(options?: {
  dryRun?: boolean;
}): Promise<DigestRunResult> {
  const dryRun = Boolean(options?.dryRun);
  const admin = createAdminClient();
  const site = getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const cooldownBefore = Date.now() - DIGEST_COOLDOWN_MS;

  const result: DigestRunResult = {
    candidates: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  const { data: unreadHeads } = await admin
    .from("notifications")
    .select("user_id")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  const userIds = [
    ...new Set((unreadHeads ?? []).map((row) => row.user_id)),
  ].slice(0, MAX_USERS);

  for (const userId of userIds) {
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("email_enabled, email_digest_sent_at")
      .eq("user_id", userId)
      .maybeSingle();

    const emailEnabled = prefs?.email_enabled ?? true;
    if (!emailEnabled) {
      result.skipped += 1;
      continue;
    }

    const lastSent = prefs?.email_digest_sent_at
      ? new Date(prefs.email_digest_sent_at).getTime()
      : 0;
    if (lastSent > cooldownBefore) {
      result.skipped += 1;
      continue;
    }

    const { data: unread } = await admin
      .from("notifications")
      .select("id, title, body, action_url, created_at")
      .eq("user_id", userId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(MAX_ITEMS);

    if (!unread?.length) {
      result.skipped += 1;
      continue;
    }

    result.candidates += 1;

    if (dryRun) {
      result.sent += 1;
      continue;
    }

    const { data: authData, error: authError } =
      await admin.auth.admin.getUserById(userId);
    const email = authData.user?.email;
    if (authError || !email) {
      result.failed += 1;
      continue;
    }

    const lines = unread.map(
      (n) => `• ${n.title}${n.body ? ` — ${n.body}` : ""}`,
    );
    const more =
      unread.length >= MAX_ITEMS
        ? `\n…and possibly more. Open the app for the full list.`
        : "";
    const text = [
      `You have ${unread.length}${unread.length >= MAX_ITEMS ? "+" : ""} unread notification${unread.length === 1 ? "" : "s"} in Beepa.`,
      "",
      ...lines,
      more,
      "",
      `Open: ${site}/app/my/notifications`,
    ].join("\n");

    const htmlItems = unread
      .map((n) => {
        const href = n.action_url
          ? n.action_url.startsWith("http")
            ? n.action_url
            : `${site}${n.action_url}`
          : null;
        const link = href
          ? `<a href="${escapeHtml(href)}">${escapeHtml(n.title)}</a>`
          : escapeHtml(n.title);
        return `<li><strong>${link}</strong>${n.body ? ` — ${escapeHtml(n.body)}` : ""}</li>`;
      })
      .join("");

    const html = `
      <p>You have <strong>${unread.length}${unread.length >= MAX_ITEMS ? "+" : ""}</strong> unread notification${unread.length === 1 ? "" : "s"} in Beepa.</p>
      <ul>${htmlItems}</ul>
      <p><a href="${escapeHtml(`${site}/app/my/notifications`)}">Open notifications</a></p>
    `;

    const send = await sendTransactionalEmail({
      to: email,
      subject: `Beepa: ${unread.length} unread notification${unread.length === 1 ? "" : "s"}`,
      html,
      text,
      idempotencyKey: `digest/${userId}/${new Date().toISOString().slice(0, 10)}`,
    });

    if ("skipped" in send && send.skipped) {
      result.skipped += 1;
      continue;
    }
    if (!send.ok) {
      result.failed += 1;
      continue;
    }

    if (prefs) {
      await admin
        .from("notification_preferences")
        .update({
          email_digest_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    } else {
      await admin.from("notification_preferences").insert({
        user_id: userId,
        email_enabled: true,
        email_digest_sent_at: new Date().toISOString(),
      });
    }

    result.sent += 1;
  }

  return result;
}
