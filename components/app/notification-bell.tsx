"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconBell } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { markNotificationRead } from "@/lib/notifications/actions";
import type { Tables } from "@/types/database";
import { toast } from "sonner";

type NotificationRow = Pick<
  Tables<"notifications">,
  "id" | "title" | "body" | "read_at" | "created_at" | "action_url"
>;

type NotificationBellProps = {
  userId: string;
  initialUnreadCount?: number;
  href?: string;
  className?: string;
};

export function NotificationBell({
  userId,
  initialUnreadCount = 0,
  href = "/app/my/notifications",
  className,
}: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  const loadNotifications = useCallback(async () => {
    const supabase = createClient();
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, title, body, read_at, created_at, action_url")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null),
    ]);

    setNotifications(data ?? []);
    if (count !== null) setUnreadCount(count);
  }, [userId]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadNotifications();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadNotifications]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadNotifications();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, loadNotifications]);

  async function handleNotificationClick(notification: NotificationRow) {
    if (!notification.read_at) {
      const result = await markNotificationRead(notification.id);
      if (result.ok) {
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id
              ? { ...n, read_at: new Date().toISOString() }
              : n,
          ),
        );
      } else {
        toast.error(result.error ?? "Could not mark notification as read.");
      }
    }

    setOpen(false);
    if (notification.action_url) {
      router.push(notification.action_url);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn("relative min-h-11 min-w-11", className)}
            aria-label="Notifications"
          />
        }
      >
        <IconBell stroke={1.75} className="size-5" />
        {unreadCount > 0 ? (
          <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-green text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <PopoverHeader className="border-b border-line px-4 py-3">
          <PopoverTitle>Notifications</PopoverTitle>
        </PopoverHeader>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate">
              No notifications yet.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void handleNotificationClick(n)}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors hover:bg-mist/60",
                      !n.read_at && "bg-soft-green/30",
                    )}
                  >
                    <p className="text-sm font-medium text-navy">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[10px] text-slate">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t border-line p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            nativeButton={false}
            render={<Link href={href} onClick={() => setOpen(false)} />}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
