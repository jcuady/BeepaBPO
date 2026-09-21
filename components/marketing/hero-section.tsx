import Link from "next/link";
import Image from "next/image";
import { IconArrowRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";
import { SectionEyebrow } from "@/components/beepa/section-eyebrow";
import { BRAND } from "@/lib/site";
import heroPhoto from "../../public/images/hero/beepa-team-hero.png";

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-x-clip bg-white pt-8 pb-12 sm:pt-10 sm:pb-14 lg:pt-10 lg:pb-16"
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
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <div data-hero="badge">
              <SectionEyebrow>{BRAND.tagline}</SectionEyebrow>
            </div>

            <h1
              id="hero-heading"
              data-hero="title"
              className="mt-4 font-display text-[clamp(2.25rem,4.4vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-balance sm:mt-5"
            >
              <span className="block text-navy">People power</span>
              <span className="block text-green-strong">better business.</span>
            </h1>

            <p
              data-hero="lede"
              className="mt-4 max-w-[36ch] text-base leading-relaxed text-pretty text-slate sm:mt-5 sm:text-lg"
            >
              BeepoBPO builds dependable outsourced teams with clear support, so
              you can scale with confidence.
            </p>

            <div
              data-hero="ctas"
              className="mt-7 flex w-full flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center"
            >
              <Button
                size="lg"
                className="group min-h-11 w-full gap-2 rounded-full px-6 text-base transition-[transform,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] sm:w-auto"
                nativeButton={false}
                render={
                  <Link href="/contact" data-analytics="hero_primary_cta" />
                }
              >
                Let&apos;s Talk
                <span className="flex size-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5">
                  <IconArrowRight
                    stroke={1.75}
                    className="size-3.5"
                    aria-hidden="true"
                  />
                </span>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-11 w-full rounded-full border-navy/20 bg-white px-6 text-base text-navy transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] sm:w-auto [@media(hover:hover)_and_(pointer:fine)]:hover:border-navy/35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist"
                nativeButton={false}
                render={
                  <Link href="/#services" data-analytics="hero_secondary_cta" />
                }
              >
                Explore Our Services
              </Button>
            </div>
          </div>

          <div
            data-hero="media"
            className="lg:col-span-6 lg:col-start-7"
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-mist shadow-[0_24px_48px_-28px_rgb(31_32_88_/_0.35)] sm:aspect-[16/10] lg:aspect-[4/3] lg:rounded-[1.75rem]">
              <Image
                src={heroPhoto}
                alt="Beepa professionals collaborating in a bright office"
                fill
                priority
                quality={70}
                sizes="(max-width: 640px) 92vw, (max-width: 1024px) 90vw, 48vw"
                className="object-cover object-[72%_42%] lg:object-[70%_center]"
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
