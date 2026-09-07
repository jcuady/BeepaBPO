import type { Metadata } from "next";
import { format } from "date-fns";
import { IconFileText } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { DocumentDownloadButton } from "@/components/app/documents/document-download-button";
import { DocumentUploadForm } from "@/components/app/documents/document-upload-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "Documents" };

export default async function ClientDocumentsPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

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
    const { data } = await supabase
      .from("documents")
      .select("id, title, category, created_at, visibility")
      .eq("client_organization_id", clientOrgId)
      .in("visibility", ["client_visible", "public"])
      .order("created_at", { ascending: false })
      .limit(50);
    documents = data ?? [];
  }

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Shared client documents. Downloads use time-limited signed links."
      />
      {clientOrgId ? (
        <DocumentUploadForm
          mode="client"
          clientOrganizationId={clientOrgId}
        />
      ) : null}
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
    </PageContainer>
  );
}
