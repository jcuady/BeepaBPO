import { redirect } from "next/navigation";
import { resolveWorkspace } from "@/lib/auth/workspace";

export default async function MyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login?next=/app/my");
  if (!workspace.isInternal) redirect("/app");
  return children;
}
