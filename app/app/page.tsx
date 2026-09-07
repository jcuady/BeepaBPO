import { redirect } from "next/navigation";
import { landingPathFor } from "@/lib/auth/landing";
import { resolveWorkspace } from "@/lib/auth/workspace";

export default async function AppHomePage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login?next=/app");

  redirect(
    landingPathFor({
      membershipCount: workspace.memberships.length,
      isApplicantOnly: workspace.isApplicantOnly,
      isInternal: workspace.isInternal,
      isClient: workspace.isClient,
      permissions: workspace.permissions,
    }),
  );
}
