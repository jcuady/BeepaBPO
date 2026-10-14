import Link from "next/link";
import {
  IconArrowRight,
  IconDatabase,
  IconEyeOff,
  IconFileDescription,
  IconLockAccess,
  IconShieldCheck,
  IconUsersGroup,
} from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";
import { BreadcrumbJsonLd } from "@/components/marketing/breadcrumb-json-ld";
import { FinalCTA } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/site";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Security & data handling",
  description:
    "How Beepa protects client data: placed staff are Beepa employees, access is scoped per organization by row-level security, and every record is permission-checked.",
  path: "/security",
});

/**
 * Every claim on this page is verifiable in this repository.
 *
 * That constraint is deliberate. The brandbook forbids inventing metrics,
 * awards and certifications (repeated in five documents), and a BPO security
 * page is exactly where a fabricated "ISO 27001 certified" badge would do the
 * most damage — it is the single claim a prospect's security team verifies
 * first. So the page makes only claims that can be checked in the code:
 *
 *  - placed staff are Beepa employees           -> the manpower model itself
 *  - 233 row-level security policies, 84 tables -> counted in supabase/*.sql
 *  - one client can never read another's rows   -> org-scoped RLS policies
 *  - immutable attendance event log             -> attendance_events, append-only
 *
 * The "what we do not claim" section below is not filler. It converts the
 * absence of certifications from a thing a buyer has to discover into a thing
 * we state up front.
 */
const CONTROLS = [
  {
    title: "Employment sits with Beepa",
    description:
      "The people placed on your team are Beepa employees on Beepa's payroll, not contractors you have to onboard yourself. Employment, salary and statutory obligations stay on our side of the line, so accountability for conduct does not get split across two organisations.",
    icon: IconUsersGroup,
  },
  {
    title: "Access is scoped per organization",
    description:
      "Every client organisation is isolated at the database, not by a filter in the interface. 233 row-level security policies across 84 tables mean a request for one client's records is rejected by the database itself if it belongs to another.",
    icon: IconDatabase,
  },
  {
    title: "Access is permission-checked",
    description:
      "Access follows the job, not seniority. A named permission set decides whether a person can approve leave, read payroll, or see a client's tickets — so a placed specialist sees the work they were hired to do and nothing beyond it.",
    icon: IconLockAccess,
  },
  {
    title: "Records are append-only where it counts",
    description:
      "Time and attendance events are written to an immutable log rather than edited in place. A correction is a new, attributable event, so the record of who was working when cannot be quietly rewritten.",
    icon: IconFileDescription,
  },
  {
    title: "Confidentiality before access",
    description:
      "Terms of confidentiality are signed before a placed person reaches client systems or data. It is part of the employment agreement, which is one of the reasons the employment stays with Beepa in the first place.",
    icon: IconShieldCheck,
  },
  {
    title: "We do not resell or mine your data",
    description:
      "Client data is used to deliver the engagement it was given for. It is not sold, not used to train anything, and not pooled with another client's records. Deletion follows the terms on request.",
    icon: IconEyeOff,
  },
] as const;

const NOT_CLAIMED = [
  "We are not ISO 27001 certified, and we do not display a badge we have not earned.",
  "We do not publish a SOC 2 report. When a prospect's security review needs one, we say so in writing rather than pointing at this page.",
  "We do not claim zero breaches, because we will not make a claim we cannot evidence.",
] as const;

export default function SecurityPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Security", path: "/security" },
        ]}
      />
      <PageHero
        eyebrow="Security & data handling"
        title="Your data stays behind your organization boundary."
        description={
          <>
            {BRAND.displayName} places people who work inside your business on your
            tools. That makes access control part of the job rather than a
            line in a policy document — here is exactly how it is handled.
          </>
        }
        cta={{ href: "/contact", label: "Request talent" }}
        secondaryCta={{ href: "/why-beepa", label: "Why Beepa" }}
        aside={
          <dl className="grid grid-cols-2 gap-px border border-line bg-line">
            <div className="bg-white p-5">
              <dt className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">
                RLS policies
              </dt>
              <dd className="mt-2 font-display text-3xl font-bold text-navy">
                233
              </dd>
            </div>
            <div className="bg-white p-5">
              <dt className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">
                Protected tables
              </dt>
              <dd className="mt-2 font-display text-3xl font-bold text-navy">
                84
              </dd>
            </div>
          </dl>
        }
      />

      <section className="bg-white py-20 md:py-28">
        <Container>
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-6">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-green-strong">
                The controls
              </p>
              <SectionHeading as="h2" className="mt-3">
                Six things that are true by construction.
              </SectionHeading>
            </div>
            <p className="max-w-[42ch] text-base leading-relaxed text-slate lg:col-span-6 lg:justify-self-end">
              Isolation enforced by the database is the one that matters. Anything
              enforced in an interface is one forgotten filter away from being
              wrong.
            </p>
          </div>

          <ul className="mt-12 grid gap-0 sm:grid-cols-2 lg:grid-cols-3">
            {CONTROLS.map((control) => {
              const Icon = control.icon;
              return (
                <li
                  key={control.title}
                  className="border-t border-line py-8 sm:pr-8 lg:pr-10"
                >
                  <Icon
                    stroke={1.5}
                    className="size-7 text-green-strong"
                    aria-hidden
                  />
                  <h3 className="mt-4 font-display text-lg font-bold text-navy">
                    {control.title}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-slate">
                    {control.description}
                  </p>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      <section className="bg-navy py-20 md:py-24">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">
                What we do not claim
              </p>
              <SectionHeading as="h2" className="mt-3 text-white">
                The short list is part of the answer.
              </SectionHeading>
              <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-white/70">
                A security page that only lists strengths reads like a brochure. If
                your review needs a certificate we do not hold, you should hear it
                from us before you find it.
              </p>
              <Button
                className="mt-8 group min-h-11 w-fit gap-2 rounded-none bg-green-strong text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-green active:scale-[0.97] motion-reduce:active:scale-100"
                nativeButton={false}
                render={<Link href="/contact" />}
              >
                Ask us directly
                <span className="flex size-6 items-center justify-center rounded-none bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 motion-reduce:translate-x-0">
                  <IconArrowRight stroke={2} className="size-3" aria-hidden />
                </span>
              </Button>
            </div>

            <ul className="lg:col-span-7">
              {NOT_CLAIMED.map((item) => (
                <li
                  key={item}
                  className="flex gap-4 border-b border-white/15 py-5 text-base leading-relaxed text-white/85 first:border-t last:border-b-0"
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
        </Container>
      </section>

      <section className="border-b border-line/70 bg-mist/40 py-16 md:py-20">
        <Container>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-navy sm:text-2xl">
                Read the terms behind these commitments.
              </h2>
              <p className="mt-2 max-w-[52ch] text-base leading-relaxed text-slate">
                The privacy notice covers what we collect and why. The terms cover
                confidentiality, data return and deletion.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="min-h-11 rounded-none border-navy/20 bg-transparent text-navy transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-navy/35 hover:bg-white active:scale-[0.97] motion-reduce:active:scale-100"
                nativeButton={false}
                render={<Link href="/privacy" />}
              >
                Privacy notice
              </Button>
              <Button
                variant="outline"
                className="min-h-11 rounded-none border-navy/20 bg-transparent text-navy transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-navy/35 hover:bg-white active:scale-[0.97] motion-reduce:active:scale-100"
                nativeButton={false}
                render={<Link href="/terms" />}
              >
                Terms
              </Button>
            </div>
          </div>
        </Container>
      </section>

      <FinalCTA />
    </>
  );
}