import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconBriefcase, IconMapPin } from "@tabler/icons-react";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { humanizeEnum } from "@/lib/utils";

export const metadata: Metadata = { title: "Open roles" };

function label(value: string | null | undefined): string {
  // Generic enums only (location_type, employment_type). Application stages
  // have their own table with meaning attached — see application-stage.ts.
  return humanizeEnum(value);
}

/**
 * In-app careers for the applicant.
 *
 * Previously the only way to apply was the public `/careers` page, which meant a
 * signed-in applicant had to leave the app they were already in, re-enter their
 * details, and land back on `/app/applicant` with no link back to the role list.
 * The empty state even pointed at `/careers`, so the first thing the app told an
 * applicant to do was leave it.
 *
 * Data access needs no new grant: `job_posts_select_published` already lets any
 * authenticated user read rows where `status = 'published'`. The applicant role
 * deliberately does NOT hold `recruitment.read` — `20260911150000` removed it
 * because that permission would expose the whole applicant table — so this page
 * filters on status alone and never queries `applicants`.
 */
export default async function ApplicantJobsPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login?next=/app/applicant/jobs");

  const supabase = await createClient();

  const [{ data: jobs }, { data: applicant }] = await Promise.all([
    supabase
      .from("job_posts")
      .select(
        "id, title, slug, location_text, location_type, employment_type, salary_display, published_at",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50),
    supabase
      .from("applicants")
      .select("id")
      .eq("profile_id", workspace.user.id)
      .maybeSingle(),
  ]);

  // Which of these the applicant has already applied to, so the list can say so
  // rather than letting them hit a duplicate-application error on submit.
  const appliedIds = new Set<string>();
  if (applicant?.id && (jobs?.length ?? 0) > 0) {
    const { data: mine } = await supabase
      .from("job_applications")
      .select("job_post_id, stage")
      .eq("applicant_id", applicant.id)
      .in(
        "job_post_id",
        (jobs ?? []).map((j) => j.id),
      );
    for (const row of mine ?? []) appliedIds.add(row.job_post_id);
  }

  const list = jobs ?? [];

  return (
    <PageContainer size="narrow">
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Open roles at Beepa BPO."
        quote="Every great career starts with a single step forward."
      />

      {list.length === 0 ? (
        <EmptyState
          icon={IconBriefcase}
          title="No open roles right now"
          description="New vacancies are posted here as soon as they open. Check back soon."
          actionLabel="Back to my applications"
          actionHref="/app/applicant"
        />
      ) : (
        <div className="space-y-3">
          {list.map((job) => {
            const applied = appliedIds.has(job.id);
            return (
              <Card key={job.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-display text-base font-semibold text-navy">
                        {job.title}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-slate sm:text-sm">
                        <span className="inline-flex items-center gap-1">
                          <IconMapPin
                            aria-hidden
                            className="size-4 shrink-0"
                          />
                          {job.location_text ?? label(job.location_type)}
                        </span>
                        <span>{label(job.employment_type)}</span>
                      </p>
                      {job.salary_display ? (
                        <p className="text-base font-medium text-green-strong sm:text-sm">
                          {job.salary_display}
                        </p>
                      ) : null}
                    </div>
                    {applied ? (
                      <span className="rounded-full border border-green/30 bg-green/10 px-2.5 py-0.5 text-sm font-medium text-green-strong">
                        Applied
                      </span>
                    ) : null}
                  </div>

                  <Link
                    href={`/app/applicant/jobs/${job.id}`}
                    className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
                  >
                    {applied ? "View role" : "View and apply"}
                    <span className="sr-only"> — {job.title}</span>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Link
        href="/app/applicant"
        className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
      >
        ← My applications
      </Link>
    </PageContainer>
  );
}