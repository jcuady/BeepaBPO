import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { JobPostForm } from "@/components/app/recruitment/job-post-form";
import { JobPostStatusActions } from "@/components/app/recruitment/job-post-status-actions";
import { resolveWorkspace, requirePermission, requireInternal } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IconBriefcase } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "Job Posts" };

export default async function RecruitmentJobsPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  requirePermission(workspace, "recruitment.read");

  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("job_posts")
    .select("id, title, slug, status, location_text, published_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const canManage = workspace.permissions.has("recruitment.manage");

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Create, publish, edit, and close job posts."
      />

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              New job post
            </CardTitle>
          </CardHeader>
          <CardContent>
            <JobPostForm />
          </CardContent>
        </Card>
      )}

      {!jobs?.length ? (
        <EmptyState
          icon={IconBriefcase}
          title="No job posts"
          description="Create a job post to start receiving applications."
        />
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-navy">{job.title}</p>
                  <p className="text-sm text-slate">
                    {job.location_text ?? "Location TBD"} · /careers/{job.slug}
                  </p>
                  <p className="text-xs text-slate">
                    {job.published_at
                      ? `Published ${format(new Date(job.published_at), "MMM d, yyyy")}`
                      : `Created ${format(new Date(job.created_at), "MMM d, yyyy")}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {job.status}
                  </Badge>
                  <Link
                    href={`/app/recruitment/jobs/${job.id}`}
                    className="text-sm font-medium text-green-strong hover:underline"
                  >
                    {canManage ? "Edit" : "View"}
                  </Link>
                  {job.status === "published" ? (
                    <Link
                      href={`/careers/${job.slug}`}
                      className="text-sm font-medium text-green-strong hover:underline"
                    >
                      View public
                    </Link>
                  ) : null}
                  {canManage ? (
                    <JobPostStatusActions jobId={job.id} status={job.status} />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Link
        href="/app/recruitment/applicants"
        className="text-sm font-medium text-green-strong hover:underline"
      >
        View applicants →
      </Link>
    </PageContainer>
  );
}
