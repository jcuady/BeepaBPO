import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { ListPager } from "@/components/app/list-pager";
import { JobPostForm } from "@/components/app/recruitment/job-post-form";
import { JobPostStatusActions } from "@/components/app/recruitment/job-post-status-actions";
import { resolveWorkspace, requirePermission, requireInternal } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IconBriefcase } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/app/page-container";
import { enumParam, stringParam, pageParam, ilikePattern } from "@/lib/app/search-params";

export const metadata: Metadata = { title: "Job Posts" };

const STATUSES = ["draft", "published", "closed"] as const;
const PAGE_SIZE = 50;

export default async function RecruitmentJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  requirePermission(workspace, "recruitment.read");

  const params = await searchParams;
  const q = stringParam(params.q);
  const status = enumParam(params.status, STATUSES);
  const page = pageParam(params.page);
  const pattern = q ? ilikePattern(q) : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("job_posts")
    .select("id, title, slug, status, location_text, published_at, created_at")
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (pattern) query = query.ilike("title", pattern);

  const { data: jobs } = await query;
  const canManage = workspace.permissions.has("recruitment.manage");

  return (
    <PageContainer>
      <PageHeader
        title="Job Posts"
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

      <form method="get">
        <FilterBar placeholder="Search job title…" defaultValue={q}>
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
                  {/* No size declared on purpose: `Card` now sets
                      `text-base sm:text-sm` for its whole subtree, so this
                      paragraph is readable on a phone without every call site
                      having to repeat the rule. */}
                  <p className="font-medium text-navy">{job.title}</p>
                  <p className="text-base text-slate sm:text-sm">
                    {job.location_text ?? "Location TBD"} · /careers/{job.slug}
                  </p>
                  <p className="text-base text-slate sm:text-xs">
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
                    className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
                  >
                    {canManage ? "Edit" : "View"}
                  </Link>
                  {job.status === "published" ? (
                    <Link
                      href={`/careers/${job.slug}`}
                      className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
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

      <ListPager
        page={page}
        pageSize={PAGE_SIZE}
        rowCount={jobs?.length ?? 0}
        query={{ q, status }}
      />

      <Link
        href="/app/recruitment/applicants"
        className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
      >
        View applicants →
      </Link>
    </PageContainer>
  );
}