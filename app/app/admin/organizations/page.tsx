import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconBuilding } from "@tabler/icons-react";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { ListPager } from "@/components/app/list-pager";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveWorkspace, requirePermission, requireInternal } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { enumParam, pageParam } from "@/lib/app/search-params";

export const metadata: Metadata = { title: "Organizations" };

const PAGE_SIZE = 50;
const TYPES = ["internal", "client"] as const;
const STATUSES = ["active", "inactive", "onboarding"] as const;

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  requirePermission(workspace, "system.manage");

  const params = await searchParams;
  const type = enumParam(params.type, TYPES);
  const status = enumParam(params.status, STATUSES);
  const page = pageParam(params.page);

  const supabase = await createClient();
  let query = supabase
    .from("organizations")
    .select("id, name, slug, type, status, created_at")
    .order("name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (type) query = query.eq("type", type);
  if (status) query = query.eq("status", status);

  const { data: orgs } = await query;

  return (
    <PageContainer>
      <PageHeader
        title="Organizations"
        name={workspace.profile.first_name}
        subtitle="View-only list of internal and client organizations."
      />

      <form method="get">
        <FilterBar showSearch={false}>
          <FilterSelect
            name="type"
            label="Type"
            defaultValue={type ?? ""}
            options={[
              { value: "", label: "All types" },
              ...TYPES.map((t) => ({ value: t, label: t })),
            ]}
          />
          <FilterSelect
            name="status"
            label="Status"
            defaultValue={status ?? ""}
            options={[
              { value: "", label: "All statuses" },
              ...STATUSES.map((s) => ({ value: s, label: s })),
            ]}
          />
        </FilterBar>
      </form>

      {!orgs?.length ? (
        <EmptyState
          icon={IconBuilding}
          title="No organizations"
          description="Organizations will appear here."
        />
      ) : (
        <div className="space-y-2">
          {orgs.map((org) => (
            <Card key={org.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-navy">{org.name}</p>
                  <p className="text-sm text-slate">
                    {org.slug} · {org.type}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {org.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ListPager
        page={page}
        pageSize={PAGE_SIZE}
        rowCount={orgs?.length ?? 0}
        query={{ type, status }}
      />

      <Link
        href="/app/admin"
        className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
      >
        ← Back to admin
      </Link>
    </PageContainer>
  );
}