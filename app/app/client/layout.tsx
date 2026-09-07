import { redirect } from "next/navigation";
import { resolveWorkspace } from "@/lib/auth/workspace";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login?next=/app/client");
  if (!workspace.isClient) redirect("/app");
  return children;
}
