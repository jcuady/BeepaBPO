import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Careers",
  description: "Build your career with people who value your growth.",
  alternates: { canonical: "/careers" },
};

export default async function CareersPage() {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("job_posts")
    .select("id, title, slug, location_text, location_type, employment_type, salary_display, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return (
    <section className="bg-white py-20 md:py-28">
      <Container className="max-w-3xl">
        <SectionHeading as="h1">
          Build your career with people who value your growth.
        </SectionHeading>
        <p className="mt-6 text-base leading-relaxed text-slate">
          Explore open roles at Beepa. Sign in or create an account to submit
          your application.
        </p>

        <div className="mt-10 space-y-3">
          {!jobs?.length ? (
            <p className="text-sm text-slate">
              No open roles right now. Check back soon or{" "}
              <Link href="/contact" className="text-green-strong hover:underline">
                get in touch
              </Link>
              .
            </p>
          ) : (
            jobs.map((job) => (
              <Card
                key={job.id}
                className=""
              >
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-display text-lg font-semibold text-navy">
                      {job.title}
                    </p>
                    <p className="text-sm text-slate">
                      {job.location_text ?? job.location_type.replace(/_/g, " ")}{" "}
                      · {job.employment_type.replace(/_/g, " ")}
                      {job.salary_display ? ` · ${job.salary_display}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Open</Badge>
                    <Button
                      nativeButton={false}
                      render={<Link href={`/careers/${job.slug}`} />}
                    >
                      View role
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </Container>
    </section>
  );
}
