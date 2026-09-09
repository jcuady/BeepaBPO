import Link from "next/link";
import {
  IconArrowRight,
  IconCoin,
  IconSearch,
  IconUserCheck,
} from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { SectionEyebrow } from "@/components/beepa/section-eyebrow";
import { SectionHeading } from "@/components/beepa/section-heading";
import { Button } from "@/components/ui/button";

/**
 * Manpower model — search for people, place them, handle salary.
 * Replaces the old consultancy-style “how it works” timeline.
 */
export function ManpowerModelSection() {
  return (
    <section
      id="how-we-work"
      data-manpower-model
      className="scroll-mt-24 border-y border-line/70 bg-white py-24 md:py-32"
    >
      <Container>
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-12">
          <div className="lg:col-span-7">
            <SectionEyebrow>Talent &amp; payroll</SectionEyebrow>
            <SectionHeading className="mt-3 max-w-[18ch] text-balance">
              We find the people. We handle the pay.
            </SectionHeading>
          </div>
          <p className="max-w-[40ch] text-base leading-relaxed text-slate lg:col-span-5 lg:justify-self-end lg:pb-1">
            Beepa is a manpower partner — we search for the right talent, place
            them on your team, and manage salary so you stay focused on the work.
          </p>
        </div>

        {/* Asymmetric two-pillar model — not a 3-card feature row */}
        <div className="mt-14 grid gap-6 md:mt-16 lg:grid-cols-12 lg:gap-8">
          <article className="relative overflow-hidden rounded-[28px] bg-navy px-8 py-10 text-white lg:col-span-7 lg:px-10 lg:py-12">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-16 top-0 font-display text-[11rem] font-extrabold leading-none tracking-tighter text-white/[0.04]"
            >
              01
            </span>
            <span className="relative flex size-12 items-center justify-center rounded-[14px] bg-white/10 text-lime ring-1 ring-white/15">
              <IconSearch stroke={1.5} className="size-6" aria-hidden />
            </span>
            <h3 className="relative mt-8 font-display text-2xl font-bold tracking-tight text-white text-balance md:text-[1.75rem]">
              Search &amp; place talent
            </h3>
            <p className="relative mt-3 max-w-[42ch] text-base leading-relaxed text-white/70">
              Tell us the roles, skills, and schedule. We source candidates,
              shortlist fit, and place people who can start delivering on your
              team.
            </p>
            <ul className="relative mt-8 space-y-3 border-t border-white/10 pt-6 text-sm text-white/80">
              <li className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-lime" aria-hidden />
                Role brief and requirements clarity
              </li>
              <li className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-lime" aria-hidden />
                Sourcing, screening, and shortlists
              </li>
              <li className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-lime" aria-hidden />
                Placement into your workflow
              </li>
            </ul>
          </article>

          <article className="relative flex flex-col overflow-hidden rounded-[28px] bg-mist px-8 py-10 ring-1 ring-line lg:col-span-5 lg:px-9 lg:py-12">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-10 top-0 font-display text-[9rem] font-extrabold leading-none tracking-tighter text-navy/[0.04]"
            >
              02
            </span>
            <span className="relative flex size-12 items-center justify-center rounded-[14px] bg-soft-green text-green-strong ring-1 ring-green-strong/10">
              <IconCoin stroke={1.5} className="size-6" aria-hidden />
            </span>
            <h3 className="relative mt-8 font-display text-2xl font-bold tracking-tight text-navy text-balance">
              We handle the salary
            </h3>
            <p className="relative mt-3 max-w-[36ch] text-base leading-relaxed text-slate">
              Once people are placed, Beepa manages pay so your team gets paid
              on time — without you building a full HR payroll stack.
            </p>
            <div className="relative mt-auto flex items-start gap-3 border-t border-line pt-8">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-green-strong ring-1 ring-line">
                <IconUserCheck stroke={1.5} className="size-5" aria-hidden />
              </span>
              <p className="text-sm leading-relaxed text-slate">
                You get working people. We take care of employment pay
                administration behind the scenes.
              </p>
            </div>
          </article>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-line pt-10 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[44ch] text-sm leading-relaxed text-slate md:text-base">
            Need a role filled? Share what you need — we&apos;ll start the search.
          </p>
          <Button
            className="group min-h-11 w-fit gap-2 rounded-full bg-green-strong text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-green active:scale-[0.97]"
            nativeButton={false}
            render={<Link href="/contact" />}
          >
            Request talent
            <span className="flex size-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
              <IconArrowRight stroke={2} className="size-3" aria-hidden />
            </span>
          </Button>
        </div>
      </Container>
    </section>
  );
}
