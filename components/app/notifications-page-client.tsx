"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { IconBell, IconBellRinging } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/app/empty-state";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import {
  markAllRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "@/lib/notifications/actions";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  action_url: string | null;
};

type NotificationPreferences = {
  in_app_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
};

type NotificationsPageClientProps = {
  notifications: NotificationItem[];
  preferences: NotificationPreferences | null;
};

export function NotificationsPageClient({
  notifications,
  preferences,
}: NotificationsPageClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { state: pushState, error: pushError, subscribe } = usePushSubscription();

  const prefs = preferences ?? {
    in_app_enabled: true,
    push_enabled: true,
    email_enabled: true,
  };

  function handleMarkAllRead() {
    startTransition(async () => {
      const result = await markAllRead();
      if (result.ok) {
        toast.success("All notifications marked as read.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not mark notifications as read.");
      }
    });
  }

  async function handleNotificationClick(notification: NotificationItem) {
    if (!notification.read_at) {
      await markNotificationRead(notification.id);
      router.refresh();
    }
    if (notification.action_url) {
      router.push(notification.action_url);
    }
  }

  function handlePrefChange(
    key: keyof NotificationPreferences,
    checked: boolean,
  ) {
    startTransition(async () => {
      const result = await updateNotificationPreferences({ [key]: checked });
      if (result.ok) {
        toast.success("Preferences updated.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not update preferences.");
      }
    });
  }

  async function handleEnablePush() {
    const ok = await subscribe();
    if (ok) {
      toast.success("Push notifications enabled.");
      if (!prefs.push_enabled) {
        await updateNotificationPreferences({ push_enabled: true });
        router.refresh();
      }
    } else if (pushError) {
      toast.error(pushError);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-navy">Preferences</h2>
            <div className="flex flex-wrap gap-2">
              {notifications.some((n) => !n.read_at) ? (
                <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                disabled={pending}
                onClick={handleMarkAllRead}
              >
                Mark all read
              </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                disabled={pending || pushState === "loading" || pushState === "subscribed"}
                onClick={() => void handleEnablePush()}
              >
                <IconBellRinging stroke={1.75} className="size-4" />
                {pushState === "subscribed" ? "Push enabled" : "Enable push"}
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            {(
              [
                ["in_app_enabled", "In-app notifications"],
                ["push_enabled", "Push notifications"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <span className="text-sm text-navy">{label}</span>
                <Switch
                  checked={prefs[key]}
                  disabled={pending}
                  onCheckedChange={(checked) =>
                    handlePrefChange(key, checked === true)
                  }
                />
              </div>
            ))}
            {/* ponytail: email_enabled column exists but notifyUser does not send email yet */}
            <p className="text-xs text-slate">
              Email digests are not available yet.
            </p>
          </div>
        </CardContent>
      </Card>

      {!notifications.length ? (
        <EmptyState
          icon={IconBell}
          title="No notifications"
          description="You're all caught up."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={cn(
                "",
                !n.read_at && "border-green/30 bg-soft-green/20",
              )}
            >
              <CardContent className="p-4">
                {n.action_url ? (
                  <button
                    type="button"
                    onClick={() => void handleNotificationClick(n)}
                    className="block w-full text-left hover:opacity-90"
                  >
                    <p className="font-medium text-navy">{n.title}</p>
                    <p className="mt-1 text-sm text-slate">{n.body}</p>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleNotificationClick(n)}
                    className="block w-full text-left"
                  >
                    <p className="font-medium text-navy">{n.title}</p>
                    <p className="mt-1 text-sm text-slate">{n.body}</p>
                  </button>
                )}
                <p className="mt-2 text-xs text-slate">
                  {format(new Date(n.created_at), "MMM d, yyyy h:mm a")}
                  {!n.read_at ? " · Unread" : ""}
                  {n.action_url ? (
                    <>
                      {" · "}
                      <Link
                        href={n.action_url}
                        className="text-green-strong hover:underline"
                      >
                        Open
                      </Link>
                    </>
                  ) : null}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
