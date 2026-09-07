import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { Container } from "@/components/beepa/container";
import { JobApplyForm } from "@/components/app/careers/job-apply-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("job_posts")
    .select("title, description")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!job) return { title: "Careers" };

  return {
    title: `${job.title} — Careers`,
    description: job.description.slice(0, 160),
  };
}

export default async function CareerDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const workspace = await resolveWorkspace();

  const { data: job } = await supabase
    .from("job_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!job) notFound();

  return (
    <section className="bg-white py-16 md:py-24">
      <Container className="max-w-3xl">
        <Link
          href="/careers"
          className="text-sm font-medium text-green-strong hover:underline"
        >
          ← All roles
        </Link>

        <h1 className="mt-6 font-display text-3xl font-bold text-navy">
          {job.title}
        </h1>
        <p className="mt-2 text-slate">
          {job.location_text ?? job.location_type} ·{" "}
          {job.employment_type.replace(/_/g, " ")}
          {job.salary_display ? ` · ${job.salary_display}` : ""}
        </p>

        {job.description ? (
          <div className="prose prose-slate mt-8 max-w-none">
            <h2 className="font-display text-lg text-navy">About the role</h2>
            <p className="whitespace-pre-wrap text-slate">{job.description}</p>
          </div>
        ) : null}

        {job.requirements ? (
          <div className="mt-6">
            <h2 className="font-display text-lg text-navy">Requirements</h2>
            <p className="mt-2 whitespace-pre-wrap text-slate">
              {job.requirements}
            </p>
          </div>
        ) : null}

        <Card className="mt-10 ">
          <CardContent className="p-6">
            <h2 className="font-display text-lg font-semibold text-navy">
              Apply for this role
            </h2>
            {!workspace ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate">
                  Sign in or create an account to submit your application.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button nativeButton={false} render={<Link href={`/login?next=/careers/${slug}`} />}>
                    Sign in
                  </Button>
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={`/signup?next=/careers/${slug}`} />}
                  >
                    Create account
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <JobApplyForm
                  jobPostId={job.id}
                  defaultValues={{
                    first_name: workspace.profile.first_name,
                    last_name: workspace.profile.last_name,
                    email: workspace.user.email ?? "",
                    phone: workspace.profile.phone ?? "",
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </Container>
    </section>
  );
}
