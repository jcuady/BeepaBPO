import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { JobPostForm } from "@/components/app/recruitment/job-post-form";
import { JobPostStatusActions } from "@/components/app/recruitment/job-post-status-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit job post" };

export default async function RecruitmentJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requirePermission(workspace, "recruitment.read");

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("job_posts")
    .select(
      "id, title, slug, status, description, requirements, responsibilities, location_text, location_type, employment_type, salary_display, published_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!job) notFound();

  const canManage = can(workspace.permissions, "recruitment.manage");

  return (
    <PageContainer size="narrow">
      <PageHeader
        name={workspace.profile.first_name}
        subtitle={job.title}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="capitalize">
          {job.status}
        </Badge>
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

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Edit job post
            </CardTitle>
          </CardHeader>
          <CardContent>
            <JobPostForm
              jobId={job.id}
              initialValues={{
                title: job.title,
                slug: job.slug,
                description: job.description,
                requirements: job.requirements,
                responsibilities: job.responsibilities,
                location_text: job.location_text ?? "",
                location_type: job.location_type,
                employment_type: job.employment_type,
                salary_display: job.salary_display ?? "",
                status: job.status,
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-slate">
          You can view this post. Editing requires recruitment manage permission.
        </p>
      )}

      <Link
        href="/app/recruitment/jobs"
        className="text-sm font-medium text-green-strong hover:underline"
      >
        ← Back to jobs
      </Link>
    </PageContainer>
  );
}
