import Link from "next/link";
import {
  IconArrowRight,
  IconBriefcase,
  IconClockHour4,
  IconReceipt,
  IconUsersGroup,
} from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";
import { BreadcrumbJsonLd } from "@/components/marketing/breadcrumb-json-ld";
import { FinalCTA } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { Button } from "@/components/ui/button";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Pricing",
  description:
    "How Beepa pricing works: every engagement is scoped to the role, hours and headcount, with sourcing, placement, employment and payroll administration included.",
  path: "/pricing",
});

/**
 * No rate card, on purpose.
 *
 * Beepa sells a manpower engagement, so the cost is a function of what the role
 * needs — experience, shift pattern, headcount, how long it runs — and a single
 * published number would be wrong for most of the people who land here. Worse,
 * a plausible-looking invented rate is precisely the kind of fabricated figure
 * the brandbook forbids, and a buyer who finds a price that does not survive the
 * first call does not come back.
 *
 * So the page sells the *model* — what drives the number, what is already
 * inside it, and what stays yours — and makes getting an actual number a
 * one-step, no-obligation ask. That is the honest version of a pricing page
 * for this business model, not a missing one.
 */
const DRIVERS = [
  {
    title: "The role and the experience it needs",
    description:
      "A support agent and a QA analyst are not the same line item. Seniority, the tools involved and the judgement the work requires set the base.",
    icon: IconBriefcase,
  },
  {
    title: "Hours and shift pattern",
    description:
      "Coverage drives cost more than headcount. A full local-day shift, an evening team and overnight cover are priced as different commitments, not as the same person for longer.",
    icon: IconClockHour4,
  },
  {
    title: "How many people",
    description:
      "One agent and a pod of ten are quoted the same way. Volume tends to help, which is why adding roles later is cheaper than starting with all of them.",
    icon: IconUsersGroup,
  },
  {
    title: "How long it runs",
    description:
      "Engagement length changes the shape of the commitment. Longer runs give us a steadier hiring pipeline and you a team that keeps learning your business.",
    icon: IconReceipt,
  },
] as const;

const INCLUDED = [
  "Role definition and sourcing",
  "Screening and shortlisting",
  "Interview coordination",
  "Placement into your tools and hours",
  "Employment and salary administration",
  "Statutory obligations handled by Beepa",
  "Ongoing account management",
];

const YOURS = [
  "Your CRM, helpdesk and licences",
  "Direction of the day-to-day work",
  "Quality standards and outcomes",
  "Your customer relationships",
  "Your own internal team",
];

const STEPS = [
  {
    step: "01",
    title: "Send the brief",
    description:
      "Tell us the roles, the hours and what good looks like. A short message is enough to start.",
  },
  {
    step: "02",
    title: "Get a shortlist",
    description:
      "We source, screen and present people you can actually interview. You decide who proceeds.",
  },
  {
    step: "03",
    title: "See the number",
    description:
      "Once the people and the shape are clear, the quote is specific. Nothing is billed before you approve a scope.",
  },
  {
    step: "04",
    title: "People start working",
    description:
      "Employment and payroll are handled on our side, so they arrive as your team without an onboarding burden on you.",
  },
] as const;

export default function PricingPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ]}
      />
      <PageHero
        eyebrow="Pricing"
        title="Priced on the work, not on a rate card."
        description={
          <>
            We are a manpower partner, so there is no single price to print. Every
            engagement is scoped to the role, the hours and the headcount — and
            the fee already includes getting the people and paying them properly.
          </>
        }
        cta={{ href: "/contact", label: "Get a number" }}
        secondaryCta={{ href: "/services", label: "See services" }}
        aside={
          <div className="border border-line bg-white p-6">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-green-strong">
              Why there is no price list
            </p>
            <p className="mt-3 text-base leading-relaxed text-slate">
              A published rate would have to assume an experience level, a shift
              and a headcount. Any of those wrong makes it useless — so we scope it
              instead, and the first number you get is specific to your brief.
            </p>
          </div>
        }
      />

      <section className="bg-white py-20 md:py-28">
        <Container>
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-6">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-green-strong">
                What sets the number
              </p>
              <SectionHeading as="h2" className="mt-3">
                Four things move the quote.
              </SectionHeading>
            </div>
            <p className="max-w-[42ch] text-base leading-relaxed text-slate lg:col-span-6 lg:justify-self-end">
              Once these four are answered, the number is arithmetic rather than a
              negotiation.
            </p>
          </div>

          <ul className="mt-12 grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
            {DRIVERS.map((driver) => {
              const Icon = driver.icon;
              return (
                <li
                  key={driver.title}
                  className="border-t border-line py-8 sm:pr-8 lg:px-8 lg:first:pl-0"
                >
                  <Icon
                    stroke={1.5}
                    className="size-7 text-green-strong"
                    aria-hidden
                  />
                  <h3 className="mt-4 font-display text-lg font-bold text-navy">
                    {driver.title}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-slate">
                    {driver.description}
                  </p>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      <section className="border-y border-line/70 bg-mist/40 py-20 md:py-24">
        <Container>
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-6">
              <SectionHeading as="h2">
                Inside the fee, and outside it.
              </SectionHeading>
            </div>
            <p className="max-w-[42ch] text-base leading-relaxed text-slate lg:col-span-6 lg:justify-self-end">
              A staffing quote that quietly excludes the expensive part — actually
              employing and paying people — is not cheaper. It is just moved.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-none bg-white p-8 ring-1 ring-line md:p-9">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-green-strong">
                Already included
              </p>
              <ul className="mt-6 space-y-4">
                {INCLUDED.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 border-b border-line pb-4 text-base text-navy last:border-0 last:pb-0"
                  >
                    <span
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-lime"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-none bg-navy p-8 text-white md:p-9">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">
                Stays with you
              </p>
              <ul className="mt-6 space-y-4">
                {YOURS.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 border-b border-white/15 pb-4 text-base text-white/85 last:border-0 last:pb-0"
                  >
                    <span
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-lime"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-white py-20 md:py-28">
        <Container>
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-6">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-green-strong">
                Getting a number
              </p>
              <SectionHeading as="h2" className="mt-3">
                Four steps, no obligation.
              </SectionHeading>
            </div>
            <p className="max-w-[42ch] text-base leading-relaxed text-slate lg:col-span-6 lg:justify-self-end">
              You are not committing to anything by asking. The quote only becomes
              real when you approve a scope and meet the people.
            </p>
          </div>

          <ol className="mt-12 grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((item) => (
              <li
                key={item.step}
                className="border-t border-line py-8 sm:pr-8 lg:px-8 lg:first:pl-0"
              >
                <p className="font-display text-[11px] font-semibold tracking-[0.18em] text-green-strong">
                  {item.step}
                </p>
                <h3 className="mt-3 font-display text-lg font-bold text-navy">
                  {item.title}
                </h3>
                <p className="mt-2 text-base leading-relaxed text-slate">
                  {item.description}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-14 flex flex-col gap-4 border-t border-line pt-10 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[44ch] text-base leading-relaxed text-slate">
              Send the roles and the hours. We will come back with a shortlist and a
              specific number.
            </p>
            <Button
              className="group min-h-11 w-fit gap-2 rounded-none bg-green-strong text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-green active:scale-[0.97] motion-reduce:active:scale-100"
              nativeButton={false}
              render={<Link href="/contact" />}
            >
              Get a number
              <span className="flex size-6 items-center justify-center rounded-none bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 motion-reduce:translate-x-0">
                <IconArrowRight stroke={2} className="size-3" aria-hidden />
              </span>
            </Button>
          </div>
        </Container>
      </section>

      <section className="border-b border-line/70 bg-mist/40 py-16 md:py-20">
        <Container>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-navy sm:text-2xl">
                Not sure which service fits the brief?
              </h2>
              <p className="mt-2 max-w-[52ch] text-base leading-relaxed text-slate">
                Describe the work and we will tell you what it is and what it is not
                — including when we are the wrong partner for it.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="min-h-11 rounded-none border-navy/20 bg-transparent text-navy transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-navy/35 hover:bg-white active:scale-[0.97] motion-reduce:active:scale-100"
                nativeButton={false}
                render={<Link href="/why-beepa" />}
              >
                How we work
              </Button>
              <Button
                variant="outline"
                className="min-h-11 rounded-none border-navy/20 bg-transparent text-navy transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-navy/35 hover:bg-white active:scale-[0.97] motion-reduce:active:scale-100"
                nativeButton={false}
                render={<Link href="/case-studies" />}
              >
                See the outcomes
              </Button>
            </div>
          </div>
        </Container>
      </section>

      <FinalCTA />
    </>
  );
}