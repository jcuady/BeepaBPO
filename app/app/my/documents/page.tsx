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
import { resolveWorkspace } from "@/lib/auth/workspace";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";
import { enumParam, pageParam } from "@/lib/app/search-params";

export const metadata: Metadata = { title: "Documents" };

const PAGE_SIZE = 25;
const VISIBILITIES = ["private", "employee_visible", "client_visible", "internal", "public"] as const;

export default async function MyDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const params = await searchParams;
  const visibility = enumParam(params.visibility, VISIBILITIES);
  const page = pageParam(params.page);

  const employee = await resolveEmployeeForUser(workspace.user.id);
  const supabase = await createClient();

  let documents: {
    id: string;
    title: string;
    category: string;
    created_at: string;
    visibility: string;
  }[] = [];

  if (employee) {
    let q = supabase
      .from("documents")
      .select("id, title, category, created_at, visibility")
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (visibility) q = q.eq("visibility", visibility);
    const { data } = await q;
    documents = data ?? [];
  }

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Your employee documents. Downloads use time-limited signed links."
      />
      {employee ? (
        <DocumentUploadForm mode="employee" employeeId={employee.id} />
      ) : (
        <p className="text-sm text-slate">
          No employee record is linked to your account, so uploads are unavailable.
        </p>
      )}

      <form method="get">
        <FilterBar showSearch={false}>
          <FilterSelect
            name="visibility"
            label="Visibility"
            defaultValue={visibility ?? ""}
            options={[
              { value: "", label: "All" },
              ...VISIBILITIES.map((v) => ({ value: v, label: v.replace(/_/g, " ") })),
            ]}
          />
        </FilterBar>
      </form>

      {documents.length === 0 ? (
        <EmptyState
          icon={IconFileText}
          title="No documents yet"
          description="Upload a file or wait for HR to share documents with you."
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
        query={{ visibility }}
      />
    </PageContainer>
  );
}