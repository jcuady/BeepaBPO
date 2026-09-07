"use client";

import { NotificationBell } from "@/components/app/notification-bell";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IconChevronDown, IconLogout, IconSearch } from "@tabler/icons-react";
import type { SerializedWorkspace } from "@/lib/app/serialize-workspace";
import { logoutAction } from "@/lib/auth/actions";

type AppHeaderProps = {
  workspace: SerializedWorkspace;
  unreadCount?: number;
  onSearchOpen?: () => void;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AppHeader({
  workspace,
  unreadCount = 0,
  onSearchOpen,
}: AppHeaderProps) {
  const { profile, roleLabel, organizationName } = workspace;

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur-sm safe-area-inset-top md:h-16 md:px-6">
      <SidebarTrigger className="md:hidden" />

      <button
        type="button"
        onClick={onSearchOpen}
        className="hidden min-h-11 flex-1 items-center gap-2 rounded-xl border border-line bg-mist/60 px-4 text-sm text-slate transition-colors hover:bg-mist md:flex md:max-w-xl"
      >
        <IconSearch stroke={1.75} className="size-4 shrink-0" />
        <span className="truncate">
          Search for requests, documents, or help…
        </span>
        <kbd className="ml-auto hidden rounded-md border border-line bg-white px-1.5 py-0.5 text-xs font-medium text-slate lg:inline">
          ⌘K
        </kbd>
      </button>

      <Button
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11 md:hidden"
        onClick={onSearchOpen}
        aria-label="Search"
      >
        <IconSearch stroke={1.75} className="size-5" />
      </Button>

      <div className="ml-auto flex items-center gap-1">
        <NotificationBell
          userId={workspace.userId}
          initialUnreadCount={unreadCount}
          href={
            workspace.isClient
              ? "/app/client/tickets"
              : "/app/my/notifications"
          }
        />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex min-h-11 items-center gap-2 rounded-lg px-2 hover:bg-mist"
              />
            }
          >
            <Avatar size="sm">
              {profile.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
              ) : null}
              <AvatarFallback className="bg-soft-green text-green-strong text-xs">
                {initials(profile.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 text-left md:block">
              <p className="truncate text-sm font-medium text-navy">
                {profile.displayName}
              </p>
              <p className="truncate text-xs text-slate">
                {roleLabel}
                {organizationName ? ` · ${organizationName}` : ""}
              </p>
            </div>
            <IconChevronDown stroke={1.75} className="hidden size-4 text-slate md:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-medium">{profile.displayName}</p>
              <p className="text-xs font-normal text-slate">{roleLabel}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <form action={logoutAction} className="w-full">
                  <button type="submit" className="flex w-full items-center gap-2">
                    <IconLogout stroke={1.75} className="size-4" />
                    Sign out
                  </button>
                </form>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
