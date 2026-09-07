import type { Metadata } from "next";
import { format } from "date-fns";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IconBriefcase } from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/app/page-container";

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
    job_posts: { title: string; slug: string; status: string } | null;
  }[] = [];

  if (applicant) {
    const { data } = await supabase
      .from("job_applications")
      .select("id, stage, created_at, job_posts(title, slug, status)")
      .eq("applicant_id", applicant.id)
      .order("created_at", { ascending: false });

    applications = (data ?? []) as typeof applications;
  }

  return (
    <PageContainer size="narrow">
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Track your application status and next steps."
        quote="Every great career starts with a single step forward."
      />

      {applications.length === 0 ? (
        <EmptyState
          icon={IconBriefcase}
          title="No applications yet"
          description="Browse open roles and apply from the careers page."
          actionLabel="View careers"
          actionHref="/careers"
        />
      ) : (
        <div className="space-y-2">
          {applications.map((app) => (
            <Card
              key={app.id}
              className=""
            >
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-navy">
                    {app.job_posts?.title ?? "Role"}
                  </p>
                  <p className="text-sm text-slate">
                    Applied {format(new Date(app.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {app.stage.replace(/_/g, " ")}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
