"use client";

import Link from "next/link";
import { useTransition } from "react";
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
import {
  IconBell,
  IconChevronDown,
  IconLogout,
  IconSearch,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";
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

function accountLinks(workspace: SerializedWorkspace) {
  if (workspace.isClient) {
    return {
      profileHref: "/app/client/settings",
      settingsHref: "/app/client/settings",
      notificationsHref: "/app/client/tickets",
    };
  }
  if (workspace.isApplicantOnly) {
    return {
      profileHref: "/app/applicant/profile",
      settingsHref: "/app/applicant/profile",
      notificationsHref: "/app/applicant",
    };
  }
  return {
    profileHref: "/app/my/profile",
    settingsHref: "/app/my/profile",
    notificationsHref: "/app/my/notifications",
  };
}

export function AppHeader({
  workspace,
  unreadCount = 0,
  onSearchOpen,
}: AppHeaderProps) {
  const { profile, roleLabel, organizationName } = workspace;
  const [pending, startTransition] = useTransition();
  const links = accountLinks(workspace);

  function handleSignOut() {
    startTransition(async () => {
      await logoutAction();
    });
  }

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
          href={links.notificationsHref}
        />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex min-h-11 items-center gap-2 rounded-lg px-2 hover:bg-mist"
                aria-label="Account menu"
              />
            }
          >
            <Avatar size="sm">
              {profile.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
              ) : null}
              <AvatarFallback className="bg-soft-green text-xs text-green-strong">
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
            <IconChevronDown
              stroke={1.75}
              className="hidden size-4 text-slate md:block"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-medium text-foreground">
                {profile.displayName}
              </p>
              <p className="text-xs font-normal text-slate">
                {roleLabel}
                {organizationName ? ` · ${organizationName}` : ""}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={<Link href={links.profileHref} />}
              className="cursor-pointer gap-2"
            >
              <IconUser stroke={1.75} className="size-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<Link href={links.settingsHref} />}
              className="cursor-pointer gap-2"
            >
              <IconSettings stroke={1.75} className="size-4" />
              Settings
            </DropdownMenuItem>
            {!workspace.isClient && !workspace.isApplicantOnly ? (
              <DropdownMenuItem
                render={<Link href={links.notificationsHref} />}
                className="cursor-pointer gap-2"
              >
                <IconBell stroke={1.75} className="size-4" />
                Notifications
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              className="cursor-pointer gap-2"
              onClick={handleSignOut}
            >
              <IconLogout stroke={1.75} className="size-4" />
              {pending ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
