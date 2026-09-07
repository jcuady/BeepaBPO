"use client";

import { useState } from "react";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppHeader } from "@/components/app/app-header";
import { MobileBottomNav } from "@/components/app/mobile-bottom-nav";
import { CommandSearch } from "@/components/app/command-search";
import { RegisterSW } from "@/components/pwa/register-sw";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import type { SerializedWorkspace } from "@/lib/app/serialize-workspace";

type AppShellProps = {
  workspace: SerializedWorkspace;
  unreadCount?: number;
  children: React.ReactNode;
};

export function AppShell({
  workspace,
  unreadCount = 0,
  children,
}: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "3rem",
        } as React.CSSProperties
      }
    >
      <TooltipProvider delay={0}>
        <AppSidebar workspace={workspace} />
        <SidebarInset className="min-h-[100dvh] bg-mist">
          <AppHeader
            workspace={workspace}
            unreadCount={unreadCount}
            onSearchOpen={() => setSearchOpen(true)}
          />
          <main className="flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-6 md:pt-6">
            {children}
          </main>
          <MobileBottomNav workspace={workspace} />
        </SidebarInset>
        <CommandSearch
          workspace={workspace}
          open={searchOpen}
          onOpenChange={setSearchOpen}
        />
        <Toaster position="top-center" richColors closeButton />
        <RegisterSW />
        <InstallPrompt />
        <OfflineBanner />
      </TooltipProvider>
    </SidebarProvider>
  );
}
