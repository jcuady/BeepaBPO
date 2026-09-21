import Link from "next/link";
import Image from "next/image";
import { IconArrowRight } from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";
import careersTeamPhoto from "../../public/images/sections/careers-team.webp";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-strong/45 focus-visible:ring-offset-2";

export function CareersBand() {
  return (
    <section
      id="careers"
      aria-labelledby="careers-heading"
      className="relative scroll-mt-24 overflow-x-clip bg-white pt-8 pb-14 sm:pt-10 sm:pb-16 lg:pt-10 lg:pb-20"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 top-0 size-[18rem] rounded-full bg-soft-green blur-[90px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-8rem] top-24 hidden size-[22rem] rounded-full bg-mist blur-[80px] lg:block"
      />

      <Container>
        <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-10">
          <Reveal className="lg:col-span-5">
            <h2
              id="careers-heading"
              className="font-display text-[clamp(2.25rem,4.4vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-balance"
            >
              <span className="block text-navy lg:whitespace-nowrap">
                People we hire
              </span>
              <span className="block text-green-strong lg:whitespace-nowrap">
                people you get.
              </span>
            </h2>
            <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-pretty text-slate sm:mt-5 sm:text-lg">
              Open roles at Beepa. We hire the talent we place on BPO teams, so
              the standard you get from us is the standard we live by.
            </p>
            <div className="mt-7 flex w-full flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/careers"
                data-analytics="careers_viewed"
                className={cn(
                  "group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-green px-6 font-display text-base font-semibold text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] sm:w-auto [@media(hover:hover)_and_(pointer:fine)]:hover:bg-green-strong",
                  focusRing,
                )}
              >
                See open roles
                <span className="flex size-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5">
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
                  "inline-flex min-h-11 w-full items-center justify-center rounded-full border border-navy/20 bg-white px-6 font-display text-base font-semibold text-navy transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] sm:w-auto [@media(hover:hover)_and_(pointer:fine)]:hover:border-navy/35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist",
                  focusRing,
                )}
              >
                Request a team
              </Link>
            </div>
          </Reveal>

          <Reveal delay={80} className="relative lg:col-span-7">
            <figure className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-mist shadow-[0_24px_48px_-28px_rgb(31_32_88_/_0.35)] sm:aspect-[16/10] lg:aspect-auto lg:min-h-[32rem] lg:rounded-[1.75rem]">
              <Image
                src={careersTeamPhoto}
                alt="Beepa team members collaborating in the office"
                fill
                sizes="(max-width: 640px) 92vw, (max-width: 1024px) 90vw, 58vw"
                quality={70}
                data-careers-media="team"
                className="object-cover object-[center_20%] transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.03]"
              />
            </figure>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
