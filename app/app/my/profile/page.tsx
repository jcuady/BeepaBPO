import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { ProfileEditForm } from "@/components/app/profile/profile-edit-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "Profile" };

export default async function MyProfilePage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  const { profile } = workspace;

  return (
    <PageContainer size="narrow">
      <PageHeader
        name={profile.first_name}
        subtitle="Your account and employment profile."
      />
      <Card className="">
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
      <Card className="">
        <CardContent className="divide-y divide-line p-0">
          {[
            { label: "First name", value: profile.first_name },
            { label: "Last name", value: profile.last_name },
            { label: "Locale", value: profile.locale },
            { label: "Status", value: profile.status },
          ].map((field) => (
            <div
              key={field.label}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between"
            >
              <span className="text-sm text-slate">{field.label}</span>
              <span className="text-sm font-medium text-navy">{field.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
