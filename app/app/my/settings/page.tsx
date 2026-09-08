import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { ChangePasswordForm } from "@/components/app/settings/change-password-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Settings" };

export default async function MySettingsPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  return (
    <PageContainer size="narrow">
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Account security and preferences."
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            Related
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <Link
            href="/app/my/profile"
            className="font-medium text-green-strong hover:underline"
          >
            Edit profile
          </Link>
          <Link
            href="/app/my/notifications"
            className="font-medium text-green-strong hover:underline"
          >
            Notification preferences
          </Link>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
