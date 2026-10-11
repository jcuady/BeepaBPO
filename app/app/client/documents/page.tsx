import type { Metadata } from "next";
import { format } from "date-fns";
import { IconFileText } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { ListPager } from "@/components/app/list-pager";
import { DocumentDownloadButton } from "@/components/app/documents/document-download-button";
import { DocumentUploadForm } from "@/components/app/documents/document-upload-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";
import { enumParam, pageParam } from "@/lib/app/search-params";

export const metadata: Metadata = { title: "Documents" };

const PAGE_SIZE = 30;

export default async function ClientDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const params = await searchParams;
  const category = enumParam(params.category, [
    "contract",
    "report",
    "policy",
    "guide",
    "other",
  ] as const);
  const page = pageParam(params.page);

  const clientOrgId = getClientOrganizationId(workspace);
  const supabase = await createClient();

  let documents: {
    id: string;
    title: string;
    category: string;
    created_at: string;
    visibility: string;
  }[] = [];

  if (clientOrgId) {
    let query = supabase
      .from("documents")
      .select("id, title, category, created_at, visibility")
      .eq("client_organization_id", clientOrgId)
      .in("visibility", ["client_visible", "public"])
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    if (category) query = query.eq("category", category);
    const { data } = await query;
    // One extra row proves a next page exists; drop it so rowCount is the rendered count.
    documents = data?.slice(0, PAGE_SIZE) ?? [];
  }

  return (
    <PageContainer>
      <PageHeader
        title="Documents"
        name={workspace.profile.first_name}
        subtitle="Shared client documents. Downloads use time-limited signed links."
      />
      {clientOrgId ? (
        <DocumentUploadForm mode="client" clientOrganizationId={clientOrgId} />
      ) : null}

      <form method="get">
        <FilterBar showSearch={false}>
          <FilterSelect
            name="category"
            label="Category"
            defaultValue={category ?? ""}
            options={[
              { value: "", label: "All categories" },
              { value: "contract", label: "Contract" },
              { value: "report", label: "Report" },
              { value: "policy", label: "Policy" },
              { value: "guide", label: "Guide" },
              { value: "other", label: "Other" },
            ]}
          />
        </FilterBar>
      </form>

      {documents.length === 0 ? (
        <EmptyState
          icon={IconFileText}
          title="No documents"
          description="Upload a shared file or wait for Beepa to publish documents here."
        />
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-navy">{doc.title}</p>
                  <p className="text-sm text-slate">
                    {doc.category} ·{" "}
                    {format(new Date(doc.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {doc.visibility.replace(/_/g, " ")}
                  </Badge>
                  <DocumentDownloadButton documentId={doc.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ListPager
        page={page}
        pageSize={PAGE_SIZE}
        rowCount={documents.length}
        query={{ category }}
      />
    </PageContainer>
  );
}