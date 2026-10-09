import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobApplyForm } from "@/components/app/careers/job-apply-form";
import { StageExplainer } from "@/components/app/recruitment/stage-badge";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { humanizeEnum } from "@/lib/utils";

export const metadata: Metadata = { title: "Role details" };

function label(value: string | null | undefined): string {
  // Generic enums only (location_type, employment_type). Application stages
  // have their own table with meaning attached — see application-stage.ts.
  return humanizeEnum(value);
}

/**
 * Role detail + apply, inside the applicant portal.
 *
 * The form is the same `JobApplyForm` the public careers page uses, so validation,
 * the duplicate-application guard and the applicant upsert behave identically
 * whether someone applies signed-out or signed-in.
 *
 * Only `status = 'published'` rows are readable. A draft or closed vacancy must
 * 404 here rather than render: the applicant has no business seeing an unposted
 * role, and a closed role would accept applications that nobody will read.
 */
export default async function ApplicantJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await resolveWorkspace();
  if (!workspace) redirect(`/login?next=/app/applicant/jobs/${id}`);

  const supabase = await createClient();

  const { data: job } = await supabase
    .from("job_posts")
    .select(
      "id, title, slug, description, requirements, responsibilities, location_text, location_type, employment_type, salary_display, status",
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!job) notFound();

  // Pre-fill from the applicant record so a returning applicant does not retype
  // everything. `applicants` is readable for one's own row via
  // `applicants_select`, which checks `profile_id = auth.uid()`.
  const { data: applicant } = await supabase
    .from("applicants")
    .select("id, first_name, last_name, email, phone")
    .eq("profile_id", workspace.user.id)
    .maybeSingle();

  let existingStage: string | null = null;
  if (applicant?.id) {
    const { data: existing } = await supabase
      .from("job_applications")
      .select("stage")
      .eq("applicant_id", applicant.id)
      .eq("job_post_id", job.id)
      .maybeSingle();
    existingStage = existing?.stage ?? null;
  }

  const alreadyApplied = existingStage !== null;

  return (
    <PageContainer size="narrow">
      <PageHeader
        name={workspace.profile.first_name}
        // The subject of this page is the role, not the applicant — without
        // `title` the H1 read "Good afternoon, Customer Support Specialist."
        title={job.title}
        subtitle={`${job.location_text ?? label(job.location_type)} · ${label(job.employment_type)}`}
      />

      {job.salary_display ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-base font-medium text-green-strong sm:text-sm">
              {job.salary_display}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {job.description ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              About the role
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-base text-slate sm:text-sm">
              {job.description}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {job.requirements ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-base text-slate sm:text-sm">
              {job.requirements}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {job.responsibilities ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Responsibilities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-base text-slate sm:text-sm">
              {job.responsibilities}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            {alreadyApplied ? "Your application" : "Apply for this role"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alreadyApplied ? (
            <div className="space-y-3">
              <StageExplainer stage={existingStage} audience="applicant" />
              <Link
                href="/app/applicant"
                className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
              >
                View all my applications
              </Link>
            </div>
          ) : (
            <JobApplyForm
              jobPostId={job.id}
              defaultValues={{
                first_name: applicant?.first_name ?? "",
                last_name: applicant?.last_name ?? "",
                email:
                  applicant?.email ??
                  // `profiles` has no email column; the auth user always does,
                  // and it is the address the applicant signed up with.
                  workspace.user.email ?? "",
                phone: applicant?.phone ?? "",
              }}
            />
          )}
        </CardContent>
      </Card>

      <Link
        href="/app/applicant/jobs"
        className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
      >
        ← All open roles
      </Link>
    </PageContainer>
  );
}