import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { NotificationsPageClient } from "@/components/app/notifications-page-client";
import { PageContainer } from "@/components/app/page-container";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Notifications" };

export default async function ApplicantNotificationsPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const supabase = await createClient();
  const [{ data: notifications }, { data: preferences }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, title, body, read_at, created_at, action_url")
      .eq("user_id", workspace.user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("notification_preferences")
      .select("in_app_enabled, push_enabled, email_enabled")
      .eq("user_id", workspace.user.id)
      .maybeSingle(),
  ]);

  return (
    <PageContainer size="narrow">
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Application updates and account alerts."
      />
      <NotificationsPageClient
        notifications={notifications ?? []}
        preferences={preferences}
      />
      <p className="text-sm text-slate">
        Update your profile or password on{" "}
        <Link
          href="/app/applicant/profile"
          className="font-medium text-green-strong hover:underline"
        >
          Profile
        </Link>
        .
      </p>
    </PageContainer>
  );
}
