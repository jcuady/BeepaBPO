import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { IconUsers } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { StatusBadge } from "@/components/app/status-badge";
import { PageContainer } from "@/components/app/page-container";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { resolveWorkspace, requirePermission, requireInternal } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { stringParam, enumParam, ilikePattern } from "@/lib/app/search-params";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Applicants" };

const STAGES = [
  "applied",
  "screening",
  "initial_interview",
  "assessment",
  "client_endorsement",
  "client_interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
  "talent_pool",
  "on_hold",
] as const;

export default async function RecruitmentApplicantsPage({
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
  const stage = enumParam(params.stage, STAGES);
  const pattern = q ? ilikePattern(q) : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("job_applications")
    .select(
      "id, stage, created_at, applicants(first_name, last_name, email), job_posts(title, slug)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (stage) query = query.eq("stage", stage);

  if (pattern) {
    const [{ data: applicantMatches }, { data: jobMatches }] =
      await Promise.all([
        supabase
          .from("applicants")
          .select("id")
          .or(
            `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`,
          )
          .limit(100),
        supabase
          .from("job_posts")
          .select("id")
          .ilike("title", pattern)
          .limit(100),
      ]);

    const applicantIds = (applicantMatches ?? []).map((row) => row.id);
    const jobIds = (jobMatches ?? []).map((row) => row.id);
    const parts: string[] = [];
    if (applicantIds.length) {
      parts.push(`applicant_id.in.(${applicantIds.join(",")})`);
    }
    if (jobIds.length) {
      parts.push(`job_post_id.in.(${jobIds.join(",")})`);
    }
    if (!parts.length) {
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      query = query.or(parts.join(","));
    }
  }

  const { data: applications } = await query;
  const rows = applications ?? [];

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Review candidates and application stages."
      />

      <form method="get">
        <FilterBar placeholder="Search name, email, or role…" defaultValue={q}>
          <FilterSelect
            name="stage"
            label="Stage"
            defaultValue={stage}
            options={[
              { value: "", label: "All stages" },
              ...STAGES.map((s) => ({
                value: s,
                label: s.replace(/_/g, " "),
              })),
            ]}
          />
        </FilterBar>
      </form>

      {!rows.length ? (
        <EmptyState
          icon={IconUsers}
          title="No applicants found"
          description="Applications from the careers site will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-[16px] border border-line bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Applied</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((app) => {
                const applicant = app.applicants as {
                  first_name: string;
                  last_name: string;
                  email: string;
                } | null;
                const job = app.job_posts as {
                  title: string;
                  slug: string;
                } | null;
                const name = applicant
                  ? `${applicant.first_name} ${applicant.last_name}`
                  : "Applicant";

                return (
                  <TableRow key={app.id}>
                    <TableCell>
                      <Link
                        href={`/app/recruitment/applicants/${app.id}`}
                        className="font-medium text-navy hover:text-green-strong"
                      >
                        {name}
                      </Link>
                      <p className="text-xs text-slate">
                        {applicant?.email ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell className="text-slate">
                      {job?.title ?? "Unknown role"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={app.stage} />
                    </TableCell>
                    <TableCell className="text-slate">
                      {format(new Date(app.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Link
        href="/app/recruitment/jobs"
        className="text-sm font-medium text-green-strong hover:underline"
      >
        ← Job posts
      </Link>
    </PageContainer>
  );
}
