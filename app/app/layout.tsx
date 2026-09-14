import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { serializeWorkspace } from "@/lib/app/serialize-workspace";
import { AppShell } from "@/components/app/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { loadClientPortalFlags } from "@/lib/organizations/client-settings";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) {
    redirect("/login?next=/app");
  }

  if (workspace.memberships.length === 0) {
    return children;
  }

  let clientPortalFlags = null;
  if (workspace.isClient) {
    const supabase = await createClient();
    const orgId = getClientOrganizationId(workspace);
    if (orgId) {
      clientPortalFlags = await loadClientPortalFlags(supabase, orgId);
    }
  }

  const serialized = serializeWorkspace(workspace, clientPortalFlags);

  return (
    <AppShell workspace={serialized}>
      {children}
    </AppShell>
  );
}
