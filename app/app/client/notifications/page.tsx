import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { NotificationsPageClient } from "@/components/app/notifications-page-client";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { ListPager } from "@/components/app/list-pager";
import { PageContainer } from "@/components/app/page-container";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { enumParam, pageParam } from "@/lib/app/search-params";

export const metadata: Metadata = { title: "Notifications" };

const PAGE_SIZE = 50;
const READ_STATES = ["all", "unread", "read"] as const;

export default async function ClientNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const params = await searchParams;
  const readState = enumParam(params.read, READ_STATES) ?? "all";
  const page = pageParam(params.page);

  const supabase = await createClient();
  let query = supabase
    .from("notifications")
    .select("id, title, body, read_at, created_at, action_url")
    .eq("user_id", workspace.user.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (readState === "unread") query = query.is("read_at", null);
  else if (readState === "read") query = query.not("read_at", "is", null);

  const [{ data: notificationRows }, { data: preferences }] = await Promise.all([
    query,
    supabase
      .from("notification_preferences")
      .select("in_app_enabled, push_enabled, email_enabled")
      .eq("user_id", workspace.user.id)
      .maybeSingle(),
  ]);

  // One extra row proves a next page exists; drop it so rowCount is the rendered count.
  const notifications = notificationRows?.slice(0, PAGE_SIZE);

  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Notifications"
        name={workspace.profile.first_name}
        subtitle="Stay updated on tickets, billing, and team activity."
      />

      <form method="get">
        <FilterBar showSearch={false}>
          <FilterSelect
            name="read"
            label="Status"
            defaultValue={readState}
            options={[
              { value: "all", label: "All" },
              { value: "unread", label: "Unread" },
              { value: "read", label: "Read" },
            ]}
          />
        </FilterBar>
      </form>

      <NotificationsPageClient
        notifications={notifications ?? []}
        preferences={preferences}
      />

      <ListPager
        page={page}
        pageSize={PAGE_SIZE}
        rowCount={notifications?.length ?? 0}
        query={{ read: readState }}
      />
    </PageContainer>
  );
}