import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { ApplicationStageForm } from "@/components/app/recruitment/application-stage-form";
import { HireConvertButton } from "@/components/app/recruitment/hire-convert-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  StageBadge,
  StageExplainer,
} from "@/components/app/recruitment/stage-badge";
import { resolveWorkspace, requirePermission, requireInternal } from "@/lib/auth/workspace";
import { can, canAll } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Applicant" };

export default async function RecruitmentApplicantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  requirePermission(workspace, "recruitment.read");

  const supabase = await createClient();
  const [{ data: application }, { data: history }] = await Promise.all([
    supabase
      .from("job_applications")
      .select(
        "id, stage, notes, created_at, applicant_id, applicants(first_name, last_name, email, phone, linkedin_url, profile_id), job_posts(title, slug, status)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("application_stage_history")
      .select("id, from_stage, to_stage, notes, created_at")
      .eq("job_application_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!application) notFound();

  const applicant = application.applicants as {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    linkedin_url: string | null;
    profile_id: string | null;
  } | null;
  const job = application.job_posts as {
    title: string;
    slug: string;
    status: string;
  } | null;
  const name = applicant
    ? `${applicant.first_name} ${applicant.last_name}`
    : "Applicant";
  const canManage = can(workspace.permissions, "recruitment.manage");
  const canHire = canAll(workspace.permissions, [
    "recruitment.manage",
    "employees.manage",
  ]);

  let existingEmployeeId: string | null = null;
  if (applicant?.profile_id) {
    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("profile_id", applicant.profile_id)
      .maybeSingle();
    existingEmployeeId = employee?.id ?? null;
  }

  return (
    <PageContainer size="narrow">
      <PageHeader name={workspace.profile.first_name} subtitle={name} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="font-display text-base text-navy">
              {name}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <StageBadge stage={application.stage} />
              {job?.status === "closed" ? (
                <span className="rounded-full border border-line bg-mist px-2.5 py-0.5 text-sm font-medium text-slate">
                  Role closed
                </span>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-base sm:text-sm">
          <StageExplainer stage={application.stage} audience="staff" />
          <p className="text-slate">
            Role:{" "}
            <span className="font-medium text-navy">
              {job?.title ?? "Unknown"}
            </span>
          </p>
          <p className="text-slate">
            Email:{" "}
            <span className="font-medium text-navy">
              {applicant?.email ?? "—"}
            </span>
          </p>
          <p className="text-slate">
            Phone:{" "}
            <span className="font-medium text-navy">
              {applicant?.phone ?? "—"}
            </span>
          </p>
          <p className="text-xs text-slate">
            Applied{" "}
            {format(new Date(application.created_at), "MMM d, yyyy h:mm a")}
          </p>
          {application.notes ? (
            <p className="whitespace-pre-wrap text-slate">{application.notes}</p>
          ) : null}
          {canManage ? (
            <ApplicationStageForm
              applicationId={id}
              currentStage={application.stage}
            />
          ) : null}
          {canHire && !existingEmployeeId ? (
            <HireConvertButton
              applicationId={id}
              applicantName={name}
              alreadyHired={application.stage === "hired"}
            />
          ) : null}
          {existingEmployeeId ? (
            <p className="text-sm text-slate">
              Linked employee:{" "}
              <Link
                className="font-medium text-navy underline-offset-2 hover:underline"
                href={`/app/employees/${existingEmployeeId}`}
              >
                View profile
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="font-display text-base font-semibold text-navy">
          Stage history
        </h2>
        {(history ?? []).length === 0 ? (
          <p className="text-sm text-slate">No stage changes yet.</p>
        ) : (
          (history ?? []).map((row) => (
            <Card key={row.id}>
              <CardContent className="space-y-2 p-4 text-base sm:text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StageBadge stage={row.from_stage ?? null} />
                  <span aria-hidden className="text-slate">
                    →
                  </span>
                  <StageBadge stage={row.to_stage} />
                </div>
                <p className="text-base text-slate sm:text-sm">
                  {format(new Date(row.created_at), "MMM d, yyyy h:mm a")}
                </p>
                {row.notes ? <p className="text-slate">{row.notes}</p> : null}
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <Link
        href="/app/recruitment/applicants"
        className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
      >
        ← Back to applicants
      </Link>
    </PageContainer>
  );
}
