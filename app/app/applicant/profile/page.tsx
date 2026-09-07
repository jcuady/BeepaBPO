import type { Metadata } from "next";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { ProfileEditForm } from "@/components/app/profile/profile-edit-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Applicant Profile" };

export default async function ApplicantProfilePage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  const { profile } = workspace;

  return (
    <PageContainer size="narrow">
      <PageHeader
        name={profile.first_name}
        subtitle="Keep your applicant profile up to date."
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            Edit profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileEditForm
            defaultValues={{
              display_name: profile.display_name,
              phone: profile.phone ?? "",
              timezone: profile.timezone,
            }}
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
