import type { Metadata } from "next";
import Link from "next/link";
import {
  IconArrowRight,
  IconBriefcase,
  IconHeartHandshake,
  IconPlant2,
  IconUsersGroup,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";
import { FinalCTA } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Build your career at Beepa — a people-first manpower team that places talent and takes care of pay.",
  alternates: { canonical: "/careers" },
};

const CULTURE = [
  {
    title: "Growth that sticks",
    line: "Clear roles, real coaching, and room to take on more responsibility.",
    icon: IconPlant2,
  },
  {
    title: "People over polish",
    line: "We hire for character and teach the craft — attitude first.",
    icon: IconUsersGroup,
  },
  {
    title: "Paid with respect",
    line: "On-time pay and honest communication are non-negotiable.",
    icon: IconHeartHandshake,
  },
] as const;

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function CareersPage() {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("job_posts")
    .select(
      "id, title, slug, location_text, location_type, employment_type, salary_display, published_at",
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return (
    <>
      <PageHero
        eyebrow="Careers"
        title="Build your career with people who value your growth."
        description={
          <>
            Join {BRAND.displayName} — we place talent with companies and take
            care of the people behind every role. Sign in or create an account
            to apply.
          </>
        }
        cta={
          jobs?.length
            ? { href: "#open-roles", label: "See open roles" }
            : { href: "/contact", label: "Get in touch" }
        }
        secondaryCta={{ href: "/signup", label: "Create account" }}
      />

      <section className="bg-white py-16 md:py-20">
        <Container>
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-5">
              <SectionHeading as="h2">Life at Beepa</SectionHeading>
              <p className="mt-3 max-w-[40ch] text-base leading-relaxed text-slate">
                A manpower culture built on clear work, fair pay, and teams that
                look out for each other.
              </p>
            </div>
            <ul className="grid gap-6 sm:grid-cols-3 lg:col-span-7">
              {CULTURE.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.title} className="border-t border-line pt-5">
                    <Icon
                      stroke={1.5}
                      className="size-6 text-green-strong"
                      aria-hidden
                    />
                    <h3 className="mt-3 font-display text-base font-semibold text-navy">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate">
                      {item.line}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </Container>
      </section>

      <section
        id="open-roles"
        className="scroll-mt-24 border-t border-line bg-mist/40 py-20 md:py-28"
      >
        <Container>
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <SectionHeading as="h2">Open roles</SectionHeading>
              <p className="mt-3 max-w-[48ch] text-base leading-relaxed text-slate">
                {jobs?.length
                  ? "Pick a role, review the brief, and apply with your Beepa account."
                  : "No open roles right now — leave a note and we will reach out when something fits."}
              </p>
            </div>
            <p className="font-display text-sm text-slate lg:col-span-5 lg:justify-self-end lg:text-right">
              {jobs?.length ?? 0} open{" "}
              {(jobs?.length ?? 0) === 1 ? "role" : "roles"}
            </p>
          </div>

          {!jobs?.length ? (
            <div className="mt-12 flex flex-col items-start gap-5 rounded-[28px] bg-white p-8 ring-1 ring-line md:p-10">
              <span className="flex size-12 items-center justify-center rounded-[14px] bg-soft-green text-green-strong ring-1 ring-green-strong/10">
                <IconBriefcase stroke={1.5} className="size-6" aria-hidden />
              </span>
              <div>
                <h3 className="font-display text-xl font-bold text-navy">
                  Nothing open at the moment
                </h3>
                <p className="mt-2 max-w-[48ch] text-base leading-relaxed text-slate">
                  We post roles as client demand opens up. Tell us what you do
                  well — we keep strong people in mind.
                </p>
              </div>
              <Button
                className="group min-h-11 gap-2 rounded-full bg-green-strong text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-green active:scale-[0.97]"
                nativeButton={false}
                render={<Link href="/contact" />}
              >
                Introduce yourself
                <span className="flex size-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
                  <IconArrowRight stroke={2} className="size-3" aria-hidden />
                </span>
              </Button>
            </div>
          ) : (
            <ul className="mt-12 divide-y divide-line overflow-hidden rounded-[28px] bg-white ring-1 ring-line">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/careers/${job.slug}`}
                    className={cn(
                      "group flex flex-col gap-4 p-6 transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-7",
                      "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist/60",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-display text-lg font-semibold text-navy transition-colors duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-green-strong">
                        {job.title}
                      </p>
                      <p className="mt-1 text-sm text-slate">
                        {job.location_text ?? formatLabel(job.location_type)} ·{" "}
                        {formatLabel(job.employment_type)}
                        {job.salary_display ? ` · ${job.salary_display}` : ""}
                      </p>
                    </div>
                    <span className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-navy px-4 text-sm font-medium text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-green-strong active:scale-[0.97]">
                      View role
                      <IconArrowRight
                        stroke={2}
                        className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </section>

      <FinalCTA />
    </>
  );
}
