import Image from "next/image";
import Link from "next/link";
import { IconArrowRight, IconArrowUpRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";
import { SectionEyebrow } from "@/components/beepa/section-eyebrow";
import { SectionHeading } from "@/components/beepa/section-heading";
import { Reveal } from "@/components/marketing/reveal";

export function CareersBand() {
  return (
    <section className="bg-white py-24 md:py-32">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-center lg:gap-14">
          <Reveal>
            <SectionEyebrow>Careers at Beepa</SectionEyebrow>
            <SectionHeading className="mt-3 text-[clamp(1.75rem,3.5vw,2.5rem)]">
              Grow your career with Beepa
            </SectionHeading>
            <p className="mt-4 max-w-[48ch] text-base leading-relaxed text-slate">
              Join a team that treats opportunity, respect, and professional
              development as part of the work. Build a career that grows with
              the people you support.
            </p>
            <Button
              size="lg"
              className="group mt-8 w-full gap-2 rounded-full transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] sm:w-fit"
              nativeButton={false}
              render={<Link href="/careers" data-analytics="careers_viewed" />}
            >
              Explore Careers
              <span className="flex size-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:scale-105">
                <IconArrowRight stroke={1.75} className="size-3.5" aria-hidden />
              </span>
            </Button>
          </Reveal>

          <Reveal delay={120}>
            {/* Double-bezel image frame + floating glass card */}
            <div className="relative">
              <div className="rounded-[2rem] bg-black/[0.035] p-1.5 ring-1 ring-black/[0.06] sm:p-2">
                <div className="group relative aspect-[16/10] overflow-hidden rounded-[calc(2rem-0.4rem)] bg-mist lg:aspect-[16/9]">
                  <Image
                    src="/images/sections/careers-team.webp"
                    alt="Beepa team members collaborating in the office"
                    fill
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    quality={75}
                    className="object-cover object-center transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.04]"
                  />
                </div>
              </div>

              <Link
                href="/careers"
                className="group/card absolute -bottom-5 left-5 flex items-center gap-3 rounded-2xl bg-white/85 py-3 pl-4 pr-3 shadow-[0_16px_40px_-24px_rgb(31_32_88/0.45)] ring-1 ring-white/60 backdrop-blur-md transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1 sm:left-8"
              >
                <span className="relative flex size-2.5 shrink-0">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-green opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-green-strong" />
                </span>
                <span className="font-display text-sm font-semibold text-navy">
                  Now hiring — view open roles
                </span>
                <span className="flex size-8 items-center justify-center rounded-full bg-navy text-white transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover/card:rotate-45 [@media(hover:hover)_and_(pointer:fine)]:group-hover/card:bg-green-strong">
                  <IconArrowUpRight stroke={1.75} className="size-3.5" aria-hidden />
                </span>
              </Link>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
