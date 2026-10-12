import Link from "next/link";
import Image from "next/image";
import {
  IconArrowRight,
  IconBriefcase2,
  IconClock24,
  IconSparkles,
} from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";
import careersTeamPhoto from "../../public/images/sections/careers-team.webp";
import { focusRing } from "@/components/beepa/focus-ring";
import {
  EyebrowPill,
  StatusPill,
} from "@/components/marketing/landing-primitives";


export function CareersBand() {
  return (
    <section
      id="careers"
      aria-labelledby="careers-heading"
      className="relative isolate overflow-x-clip scroll-mt-24 bg-white pt-8 pb-14 sm:pt-10 sm:pb-16 lg:pt-14 lg:pb-20"
    >
      {/* Soft ambient tints */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-[-12%] -z-10 h-[420px] w-[420px] rounded-full bg-soft-green/45 [mask-image:radial-gradient(closest-side,black,transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 right-[-12%] -z-10 h-[440px] w-[440px] rounded-full bg-mist [mask-image:radial-gradient(closest-side,black,transparent_75%)]"
      />

      <Container>
        <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-10 xl:gap-12">
          <Reveal className="lg:col-span-5">
            <EyebrowPill>Open roles at Beepa</EyebrowPill>

            <h2
              id="careers-heading"
              className="mt-4 font-display text-[clamp(2.25rem,4.4vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-balance sm:mt-5"
            >
              <span className="block text-navy">People we hire</span>
              <span className="block text-green-strong">people you get.</span>
            </h2>
            <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-pretty text-slate sm:mt-5 sm:text-lg">
              Open roles at Beepa. We hire the talent we place on BPO teams, so
              the standard you get from us is the standard we live by.
            </p>

            {/* Inline mini-stats for social proof */}
            <div
              aria-label="14 active job postings, 6 departments"
              className="mt-7 flex flex-wrap items-center gap-2.5 sm:mt-8"
            >
              <span className="inline-flex items-center gap-2 rounded-none bg-soft-green/55 py-1.5 pr-4 pl-1.5 ring-1 ring-green-strong/10">
                <span
                  aria-hidden
                  className="flex size-6 items-center justify-center rounded-none bg-white text-green-strong"
                >
                  <IconBriefcase2 stroke={1.5} className="size-3.5" />
                </span>
                <span className="font-display text-[12px] font-semibold tracking-tight text-navy">
                  14 active postings
                </span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-none bg-mist py-1.5 pr-4 pl-1.5 ring-1 ring-line">
                <span
                  aria-hidden
                  className="flex size-6 items-center justify-center rounded-none bg-white text-navy"
                >
                  <IconSparkles stroke={1.5} className="size-3.5" />
                </span>
                <span className="font-display text-[12px] font-semibold tracking-tight text-navy">
                  6 departments
                </span>
              </span>
            </div>

            <div className="mt-7 flex w-full flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/careers"
                data-analytics="careers_viewed"
                className={cn(
                  "group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-none bg-green-strong px-6 font-display text-base font-semibold text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:active:scale-100 sm:w-auto [@media(hover:hover)_and_(pointer:fine)]:hover:bg-green",
                  focusRing,
                )}
              >
                See open roles
                <span className="flex size-7 items-center justify-center rounded-none bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5 motion-reduce:translate-x-0">
                  <IconArrowRight
                    stroke={1.75}
                    className="size-3.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
              <Link
                href="/contact"
                data-analytics="careers_contact"
                className={cn(
                  "inline-flex min-h-11 w-full items-center justify-center rounded-none border border-navy/20 bg-white px-6 font-display text-base font-semibold text-navy transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:active:scale-100 sm:w-auto [@media(hover:hover)_and_(pointer:fine)]:hover:border-navy/35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist",
                  focusRing,
                )}
              >
                Request a team
              </Link>
            </div>
          </Reveal>

          <Reveal delay={80} className="relative isolate lg:col-span-7">
            <div className="relative rounded-[2rem] bg-mist p-2 shadow-[0_30px_60px_-32px_rgba(31,32,88,0.22),0_8px_24px_-12px_rgba(11,110,52,0.10)]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.625rem] bg-white/60 ring-1 ring-line/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] sm:aspect-[16/10] lg:aspect-[5/4]">
                <Image
                  src={careersTeamPhoto}
                  alt="Beepa team members collaborating in the office"
                  fill
                  quality={82}
                  sizes="(max-width: 640px) 92vw, (max-width: 1024px) 90vw, 58vw"
                  data-careers-media="team"
                  className="object-cover object-[center_20%]"
                />
              </div>
            </div>
            {/* Floating status pill — top-right */}
            <div className="absolute -top-3 right-4 z-10 md:right-6">
              <StatusPill icon={IconSparkles} trailingIcon={IconClock24}>
                Manila · Cebu · Davao
              </StatusPill>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}