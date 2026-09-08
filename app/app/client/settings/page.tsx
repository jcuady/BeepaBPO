import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IconSettings } from "@tabler/icons-react";
import { PageContainer } from "@/components/app/page-container";
import { ChangePasswordForm } from "@/components/app/settings/change-password-form";

export const metadata: Metadata = { title: "Settings" };

export default async function ClientSettingsPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const clientOrgId = getClientOrganizationId(workspace);
  const supabase = await createClient();

  let profile: {
    industry: string | null;
    website: string | null;
    primary_contact_name: string | null;
    primary_contact_email: string | null;
    billing_currency: string | null;
  } | null = null;
  let settings: {
    allow_attendance_view: boolean;
    allow_timesheet_approval: boolean;
    allow_billing_view: boolean;
    allow_ticketing: boolean;
  } | null = null;

  if (clientOrgId) {
    const [{ data: profileRow }, { data: settingsRow }] = await Promise.all([
      supabase
        .from("client_profiles")
        .select(
          "industry, website, primary_contact_name, primary_contact_email, billing_currency",
        )
        .eq("organization_id", clientOrgId)
        .maybeSingle(),
      supabase
        .from("client_settings")
        .select(
          "allow_attendance_view, allow_timesheet_approval, allow_billing_view, allow_ticketing",
        )
        .eq("client_organization_id", clientOrgId)
        .maybeSingle(),
    ]);
    profile = profileRow;
    settings = settingsRow;
  }

  const orgName = workspace.primaryMembership?.organization.name ?? "your organization";

  return (
    <PageContainer size="narrow">
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Read-only organization profile and portal flags. Contact Beepa to change these."
      />
      {!clientOrgId ? (
        <EmptyState
          icon={IconSettings}
          title="No client organization"
          description="Your account is not linked to a client organization yet."
        />
      ) : (
        <>
          <Card className="">
            <CardHeader>
              <CardTitle className="font-display text-base text-navy">
                {orgName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-slate">Industry: {profile?.industry ?? "—"}</p>
              <p className="text-slate">Website: {profile?.website ?? "—"}</p>
              <p className="text-slate">
                Contact: {profile?.primary_contact_name ?? "—"}{" "}
                {profile?.primary_contact_email
                  ? `(${profile.primary_contact_email})`
                  : ""}
              </p>
              <p className="text-slate">
                Billing currency: {profile?.billing_currency ?? "USD"}
              </p>
            </CardContent>
          </Card>
          <Card className="">
            <CardHeader>
              <CardTitle className="font-display text-base text-navy">
                Portal access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate">
              <p>
                Attendance view: {settings?.allow_attendance_view ? "On" : "Off"}
              </p>
              <p>
                Timesheet approval:{" "}
                {settings?.allow_timesheet_approval ? "On" : "Off"}
              </p>
              <p>Billing view: {settings?.allow_billing_view ? "On" : "Off"}</p>
              <p>Ticketing: {settings?.allow_ticketing ? "On" : "Off"}</p>
            </CardContent>
          </Card>
        </>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            Your password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
