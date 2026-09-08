import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconBuilding } from "@tabler/icons-react";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Organizations" };

export default async function AdminOrganizationsPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requirePermission(workspace, "system.manage");

  const supabase = await createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, slug, type, status, created_at")
    .order("name")
    .limit(100);

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="View-only list of internal and client organizations."
      />

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

      <Link
        href="/app/admin"
        className="text-sm font-medium text-green-strong hover:underline"
      >
        ← Back to admin
      </Link>
    </PageContainer>
  );
}
