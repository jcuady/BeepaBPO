import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IconBriefcase } from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/app/page-container";
import { RealtimeRefresh } from "@/components/app/realtime-refresh";
import { StageBadge } from "@/components/app/recruitment/stage-badge";
import { pipelinePosition, stageMeta } from "@/lib/recruitment/application-stage";

export const metadata: Metadata = { title: "My Applications" };

export default async function ApplicantPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const supabase = await createClient();

  const { data: applicant } = await supabase
    .from("applicants")
    .select("id, first_name, last_name, email")
    .eq("profile_id", workspace.user.id)
    .maybeSingle();

  let applications: {
    id: string;
    stage: string;
    created_at: string;
    // `id` is included because the in-app detail route is keyed by uuid, not by
    // slug — /careers/[slug] is the public route, /app/applicant/jobs/[id] is not.
    job_posts: { id: string; title: string; slug: string; status: string } | null;
  }[] = [];

  if (applicant) {
    const { data } = await supabase
      .from("job_applications")
      .select("id, stage, created_at, job_posts(id, title, slug, status)")
      .eq("applicant_id", applicant.id)
      .order("created_at", { ascending: false })
      .limit(50);

    applications = (data ?? []) as typeof applications;
  }

  return (
    <PageContainer size="narrow">
      {applicant ? (
        <RealtimeRefresh
          tables={[
            {
              table: "job_applications",
              filter: `applicant_id=eq.${applicant.id}`,
            },
          ]}
        />
      ) : null}
      <PageHeader
        title="My Applications"
        name={workspace.profile.first_name}
        subtitle="Track your application status and next steps."
        quote="Every great career starts with a single step forward."
      />

      {applications.length === 0 ? (
        <EmptyState
          icon={IconBriefcase}
          title="No applications yet"
          description="Browse open roles and apply without leaving the portal."
          actionLabel="Browse open roles"
          actionHref="/app/applicant/jobs"
        />
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const meta = stageMeta(app.stage);
            const position = pipelinePosition(app.stage);
            // A closed vacancy means this application can no longer progress,
            // whatever stage it is sitting in. Saying so beats leaving a green
            // "Screening" badge on a role nobody is reading.
            const roleClosed = app.job_posts?.status === "closed";
            return (
              <Card key={app.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-base text-navy sm:text-sm">
                        {app.job_posts?.title ?? "Role"}
                      </p>
                      <p className="text-base text-slate sm:text-sm">
                        Applied{" "}
                        {format(new Date(app.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <StageBadge stage={app.stage} />
                  </div>

                  <p className="text-base text-slate sm:text-sm">
                    {roleClosed
                      ? "This role has closed. Your application stays on record, and you can apply for other roles."
                      : meta.applicantNote}
                  </p>

                  {position ? (
                    <p className="text-sm text-slate">
                      Step {position.index} of {position.total}
                    </p>
                  ) : null}

                  {app.job_posts?.status === "published" && app.job_posts.id ? (
                    <Link
                      href={`/app/applicant/jobs/${app.job_posts.id}`}
                      className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
                    >
                      View role
                      <span className="sr-only"> — {app.job_posts.title}</span>
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Link
        href="/app/applicant/jobs"
        className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
      >
        Browse open roles
      </Link>
    </PageContainer>
  );
}