import type { Metadata } from "next";
import Link from "next/link";
import {
  IconArrowRight,
  IconBuildingSkyscraper,
  IconCoin,
  IconSearch,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/server";
import { ABOUT_SETTING_KEY, parseAboutSetting } from "@/lib/cms/about";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";
import { FinalCTA } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Beepa began in 2019 as a people-first manpower partner — we find talent, place teams, and handle salary.",
  alternates: { canonical: "/about" },
};

const FALLBACK = {
  headline: "Built on purpose. Growing together.",
  body: "Beepa is a people-first manpower partner founded in 2019. We help businesses find dependable talent, place them on working teams, and manage salary so leaders can focus on outcomes — not hiring ops.",
};

const FALLBACK_INDUSTRIES = [
  {
    id: "fallback-saas",
    name: "Software & SaaS",
    description:
      "Support, success, and ops talent who can learn your product language fast.",
  },
  {
    id: "fallback-commerce",
    name: "Commerce & retail",
    description:
      "Customer care and back-office people who keep orders, returns, and inboxes moving.",
  },
  {
    id: "fallback-professional",
    name: "Professional services",
    description:
      "Administrative and research partners who protect partner time and client experience.",
  },
] as const;

const TIMELINE = [
  {
    year: "2019",
    title: "Founded with a people-first brief",
    line: "Started as a partner that treats talent as the product — not a cost line.",
  },
  {
    year: "Today",
    title: "Search, place, and pay",
    line: "We find the people clients need and handle salary so teams stay focused on delivery.",
  },
  {
    year: "Next",
    title: "Clearer staffing for growing companies",
    line: "More roles, tighter briefs, and the same honest split: you direct the work; we staff and pay.",
  },
] as const;

export default async function AboutPage() {
  const supabase = await createClient();
  const [{ data: aboutRow }, { data: industries }, { data: testimonials }] =
    await Promise.all([
      supabase
        .from("site_settings")
        .select("value")
        .eq("key", ABOUT_SETTING_KEY)
        .maybeSingle(),
      supabase
        .from("industries")
        .select("id, name, description")
        .eq("status", "published")
        .order("sort_order", { ascending: true })
        .limit(24),
      supabase
        .from("testimonials")
        .select("id, client_name, client_title, company_name, quote, rating")
        .eq("status", "published")
        .order("sort_order", { ascending: true })
        .limit(12),
    ]);

  const about = parseAboutSetting(aboutRow?.value) ?? FALLBACK;
  const industryList = industries?.length
    ? industries
    : [...FALLBACK_INDUSTRIES];

  return (
    <>
      <PageHero
        eyebrow="About"
        title={about.headline}
        description={
          <span className="whitespace-pre-wrap">{about.body}</span>
        }
        cta={{ href: "/contact", label: "Build your team" }}
        secondaryCta={{ href: "/why-beepa", label: "Why Beepa" }}
        aside={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[20px] bg-navy p-5 text-white">
              <IconSearch stroke={1.5} className="size-5 text-lime" aria-hidden />
              <p className="mt-3 font-display text-sm font-semibold">
                We find the people
              </p>
            </div>
            <div className="rounded-[20px] bg-white p-5 ring-1 ring-line">
              <IconCoin
                stroke={1.5}
                className="size-5 text-green-strong"
                aria-hidden
              />
              <p className="mt-3 font-display text-sm font-semibold text-navy">
                We handle the pay
              </p>
            </div>
          </div>
        }
      />

      <section className="bg-white py-20 md:py-28">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <SectionHeading as="h2">Our story</SectionHeading>
              <p className="mt-3 max-w-[36ch] text-base leading-relaxed text-slate">
                From a 2019 purpose brief to a manpower model clients can
                explain in one sentence.
              </p>
            </div>
            <ol className="lg:col-span-8">
              {TIMELINE.map((item, index) => (
                <li
                  key={item.year}
                  className="grid gap-3 border-t border-line py-8 first:border-t-0 first:pt-0 sm:grid-cols-[7rem_1fr] sm:gap-8"
                >
                  <p className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-green-strong">
                    {item.year}
                  </p>
                  <div>
                    <h3 className="font-display text-xl font-bold text-navy">
                      {item.title}
                    </h3>
                    <p className="mt-2 max-w-[52ch] text-base leading-relaxed text-slate">
                      {item.line}
                    </p>
                    <span className="sr-only">
                      Milestone {index + 1} of {TIMELINE.length}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      <section className="border-y border-line/70 bg-mist/40 py-20 md:py-24">
        <Container>
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-6">
              <SectionHeading as="h2">Industries we serve</SectionHeading>
              <p className="mt-3 max-w-[44ch] text-base leading-relaxed text-slate">
                Talent placed into the realities of your sector — tools, hours,
                and customer expectations included.
              </p>
            </div>
          </div>

          <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {industryList.map((item, index) => (
              <li
                key={item.id}
                className={
                  index === 0
                    ? "rounded-[24px] bg-navy p-7 text-white md:col-span-2 lg:col-span-1"
                    : "rounded-[24px] bg-white p-7 ring-1 ring-line"
                }
              >
                <IconBuildingSkyscraper
                  stroke={1.5}
                  className={
                    index === 0
                      ? "size-6 text-lime"
                      : "size-6 text-green-strong"
                  }
                  aria-hidden
                />
                <h3
                  className={
                    index === 0
                      ? "mt-5 font-display text-lg font-bold text-white"
                      : "mt-5 font-display text-lg font-bold text-navy"
                  }
                >
                  {item.name}
                </h3>
                {item.description ? (
                  <p
                    className={
                      index === 0
                        ? "mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/70"
                        : "mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate"
                    }
                  >
                    {item.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {testimonials?.length ? (
        <section className="bg-white py-20 md:py-28">
          <Container>
            <SectionHeading as="h2">What partners say</SectionHeading>
            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              {testimonials.map((item, index) => (
                <blockquote
                  key={item.id}
                  className={
                    index === 0
                      ? "rounded-[28px] bg-mist p-8 ring-1 ring-line lg:col-span-2 md:p-10"
                      : "rounded-[28px] border border-line bg-white p-8"
                  }
                >
                  <p className="whitespace-pre-wrap text-lg leading-relaxed text-navy md:text-xl">
                    “{item.quote}”
                  </p>
                  <footer className="mt-5 text-sm text-slate">
                    <span className="font-medium text-navy">
                      {item.client_name}
                    </span>
                    {item.client_title ? `, ${item.client_title}` : ""}
                    {item.company_name ? ` · ${item.company_name}` : ""}
                    {item.rating != null ? ` · ${item.rating}/5` : ""}
                  </footer>
                </blockquote>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      <section className="border-t border-line bg-white py-16">
        <Container>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[48ch] text-base leading-relaxed text-slate">
              Want to know if {BRAND.displayName} fits your next hire? Share the
              roles — we will start from there.
            </p>
            <Button
              className="group min-h-11 w-fit gap-2 rounded-full bg-green-strong text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-green active:scale-[0.97]"
              nativeButton={false}
              render={<Link href="/contact" />}
            >
              Let&apos;s talk
              <span className="flex size-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
                <IconArrowRight stroke={2} className="size-3" aria-hidden />
              </span>
            </Button>
          </div>
        </Container>
      </section>

      <FinalCTA />
    </>
  );
}
