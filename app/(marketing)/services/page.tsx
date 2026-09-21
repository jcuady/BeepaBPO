import type { Metadata } from "next";
import Link from "next/link";
import {
  IconArrowUpRight,
  IconChartBar,
  IconCoin,
  IconDeviceDesktop,
  IconFileDescription,
  IconHeadset,
  IconHeartHandshake,
  IconKeyboard,
  IconPresentation,
  IconSchool,
  IconSearch,
  IconSpeakerphone,
  IconUsers,
} from "@tabler/icons-react";
import type { TablerIcon } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";
import { FinalCTA } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { resolveMarketingServices } from "@/lib/marketing/services-catalog";
import { BRAND } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Talent search and payroll-backed staffing for support, ops, IT, marketing, eLearning, and sales roles — Beepa finds people and handles pay.",
  alternates: { canonical: "/services" },
};

const ICON_BY_SLUG: Record<string, TablerIcon> = {
  "customer-support": IconHeadset,
  "back-office": IconFileDescription,
  "virtual-assistants": IconUsers,
  "sales-support": IconChartBar,
  "it-support": IconDeviceDesktop,
  marketing: IconSpeakerphone,
  "elearning-course-dev": IconSchool,
  "slide-creator": IconPresentation,
  "data-entry": IconKeyboard,
  "customer-relations": IconHeartHandshake,
};

/** Asymmetric 7/5 bento tones — cycles for 10+ cards without equal columns. */
const TONES = [
  {
    card: "bg-navy text-white",
    plate: "bg-white/10 text-lime ring-white/15",
    title: "text-white",
    body: "text-white/70",
    arrow: "bg-lime text-navy",
    span: "lg:col-span-7",
  },
  {
    card: "bg-mist ring-1 ring-line",
    plate: "bg-white text-green-strong ring-green-strong/10",
    title: "text-navy",
    body: "text-slate",
    arrow: "bg-navy text-white",
    span: "lg:col-span-5",
  },
  {
    card: "bg-soft-green ring-1 ring-green-strong/10",
    plate: "bg-white text-green-strong ring-green-strong/10",
    title: "text-navy",
    body: "text-slate",
    arrow: "bg-navy text-white",
    span: "lg:col-span-5",
  },
  {
    card: "bg-white ring-1 ring-line",
    plate: "bg-soft-green text-green-strong ring-green-strong/10",
    title: "text-navy",
    body: "text-slate",
    arrow: "bg-navy text-white",
    span: "lg:col-span-7",
  },
] as const;

export default async function ServicesPage() {
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("id, title, slug, summary, description")
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .limit(50);

  const list = resolveMarketingServices(services);

  return (
    <>
      <PageHero
        eyebrow="Services"
        title="Roles filled. Payroll handled."
        description={
          <>
            {BRAND.displayName} is a manpower partner — we search for the right
            people for your roles and manage salary so you get a working team
            without building HR from scratch.
          </>
        }
        cta={{ href: "/contact", label: "Request talent" }}
        secondaryCta={{ href: "/#how-we-work", label: "How we work" }}
        aside={
          <ul className="space-y-4 rounded-[24px] bg-white p-6 ring-1 ring-line sm:p-7">
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-soft-green text-green-strong ring-1 ring-green-strong/10">
                <IconSearch stroke={1.5} className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-display text-sm font-semibold text-navy">
                  We find the people
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate">
                  Brief the role. We source, screen, and place.
                </p>
              </div>
            </li>
            <li className="flex gap-3 border-t border-line pt-4">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-soft-green text-green-strong ring-1 ring-green-strong/10">
                <IconCoin stroke={1.5} className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-display text-sm font-semibold text-navy">
                  We handle the pay
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate">
                  Salary and employment admin stay with Beepa.
                </p>
              </div>
            </li>
          </ul>
        }
      />

      <section className="bg-white py-20 md:py-28">
        <Container>
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <SectionHeading as="h2">Where we place talent</SectionHeading>
              <p className="mt-3 max-w-[48ch] text-base leading-relaxed text-slate">
                Common role families we staff. Tell us what you need — if it is
                not listed, we still search.
              </p>
            </div>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-12">
            {list.map((service, index) => {
              const tone = TONES[index % TONES.length];
              const Icon = ICON_BY_SLUG[service.slug] ?? IconUsers;
              return (
                <article
                  key={service.id}
                  id={service.slug}
                  className={cn(
                    "group relative scroll-mt-24 overflow-hidden rounded-[28px] p-8 md:col-span-12 md:p-9",
                    tone.card,
                    tone.span,
                  )}
                >
                  <span
                    className={cn(
                      "flex size-12 items-center justify-center rounded-[14px] ring-1",
                      tone.plate,
                    )}
                  >
                    <Icon stroke={1.5} className="size-6" aria-hidden />
                  </span>
                  <h3
                    className={cn(
                      "mt-7 font-display text-2xl font-bold tracking-tight text-balance",
                      tone.title,
                    )}
                  >
                    {service.title}
                  </h3>
                  {service.summary ? (
                    <p
                      className={cn(
                        "mt-3 max-w-[44ch] text-base leading-relaxed",
                        tone.body,
                      )}
                    >
                      {service.summary}
                    </p>
                  ) : null}
                  {service.description ? (
                    <p
                      className={cn(
                        "mt-3 max-w-[48ch] whitespace-pre-wrap text-sm leading-relaxed opacity-90",
                        tone.body,
                      )}
                    >
                      {service.description}
                    </p>
                  ) : null}
                  <Link
                    href="/contact"
                    className={cn(
                      "mt-8 inline-flex size-10 min-h-11 min-w-11 items-center justify-center rounded-full transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5 [@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-y-0.5",
                      tone.arrow,
                    )}
                    aria-label={`Request ${service.title} talent`}
                  >
                    <IconArrowUpRight stroke={2} className="size-4" />
                  </Link>
                </article>
              );
            })}
          </div>
        </Container>
      </section>

      <FinalCTA />
    </>
  );
}
