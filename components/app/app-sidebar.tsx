"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { IconHeadset, IconHelp } from "@tabler/icons-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import type { SerializedWorkspace } from "@/lib/app/serialize-workspace";
import {
  getAdminNavGroups,
  getPrimaryNavGroups,
} from "@/lib/app/navigation";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  workspace: SerializedWorkspace;
};

function NavLink({
  href,
  title,
  icon: Icon,
  isActive,
}: {
  href: string;
  title: string;
  icon: React.ComponentType<{ stroke?: number; className?: string }>;
  isActive: boolean;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={title}
        className={cn(
          "min-h-11 rounded-lg [&>svg]:stroke-[1.75]",
          isActive && "bg-soft-green font-medium text-green-strong",
        )}
        render={<Link href={href} />}
      >
        <Icon stroke={1.75} className="size-5 shrink-0" />
        <span>{title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function isNavActive(pathname: string, href: string) {
  if (pathname === href) return true;
  const hubs = new Set([
    "/app/my",
    "/app/client",
    "/app/applicant",
    "/app/hr",
    "/app/admin",
  ]);
  if (hubs.has(href)) return false;
  return pathname.startsWith(`${href}/`);
}

export function AppSidebar({ workspace }: AppSidebarProps) {
  const pathname = usePathname();
  const primaryGroups = getPrimaryNavGroups(workspace);
  const adminGroups = workspace.isInternal
    ? getAdminNavGroups(workspace.permissions)
    : [];

  const supportHref = workspace.isApplicantOnly
    ? "/app/applicant"
    : workspace.isClient
      ? "/app/client/tickets"
      : "/app/my/support";

  return (
    <Sidebar
      collapsible="icon"
      className="border-line bg-white [--sidebar-accent:#eef7e8] [--sidebar-accent-foreground:#0b6e34] [--sidebar-border:#eaecf0] [--sidebar-foreground:#17182b] [--sidebar:#ffffff]"
    >
      <SidebarHeader className="border-b border-line px-4 py-4">
        <Link href="/app" className="flex items-center gap-2">
          <Image
            src="/brand/beepa-logo-horizontal.png"
            alt="BEEPA"
            width={140}
            height={36}
            className="h-8 w-auto group-data-[collapsible=icon]/sidebar-wrapper:hidden"
            priority
          />
          <Image
            src="/brand/beepa-logo-alt.png"
            alt="BEEPA"
            width={32}
            height={32}
            className="hidden size-8 group-data-[collapsible=icon]/sidebar-wrapper:block"
            priority
          />
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {primaryGroups.map((group) => (
          <SidebarGroup key={group.label}>
            {primaryGroups.length > 1 ? (
              <SidebarGroupLabel className="text-xs uppercase tracking-wide text-slate">
                {group.label}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    title={item.title}
                    icon={item.icon}
                    isActive={isNavActive(pathname, item.href)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {adminGroups.length > 0 ? (
          <>
            <SidebarSeparator className="mx-2" />
            {adminGroups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel className="text-xs uppercase tracking-wide text-slate">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <NavLink
                        key={item.href}
                        href={item.href}
                        title={item.title}
                        icon={item.icon}
                        isActive={pathname.startsWith(item.href)}
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="border-t border-line p-4">
        <p className="mb-3 text-center font-display text-xs font-semibold tracking-wide text-navy group-data-[collapsible=icon]/sidebar-wrapper:hidden">
          People · Process · Progress
        </p>
        <div className="rounded-[16px] border border-line bg-soft-green/50 p-3 group-data-[collapsible=icon]/sidebar-wrapper:hidden">
          <div className="flex items-start gap-2">
            <IconHelp
              stroke={1.75}
              className="mt-0.5 size-5 shrink-0 text-green"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy">Need help?</p>
              <p className="text-xs text-slate">Contact Support</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2 h-9 w-full bg-white"
                nativeButton={false}
                render={<Link href={supportHref} />}
              >
                <IconHeadset stroke={1.75} className="size-4" />
                Contact Support
              </Button>
            </div>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
