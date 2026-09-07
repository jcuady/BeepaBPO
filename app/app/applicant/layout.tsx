import { redirect } from "next/navigation";
import { resolveWorkspace } from "@/lib/auth/workspace";

export default async function ApplicantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login?next=/app/applicant");
  if (!workspace.isApplicantOnly) redirect("/app");
  return children;
}
