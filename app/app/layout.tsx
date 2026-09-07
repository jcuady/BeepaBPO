import { redirect } from "next/navigation";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { serializeWorkspace } from "@/lib/app/serialize-workspace";
import { AppShell } from "@/components/app/app-shell";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", workspace.user.id)
    .is("read_at", null);

  const serialized = serializeWorkspace(workspace);

  return (
    <AppShell workspace={serialized} unreadCount={unreadCount ?? 0}>
      {children}
    </AppShell>
  );
}
