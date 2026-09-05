import Link from "next/link";
import {
  IconArrowRight,
  IconBulb,
  IconChartBar,
  IconUsers,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";
import { ResponsiveImageFrame } from "@/components/beepa/responsive-image-frame";
import { SectionEyebrow } from "@/components/beepa/section-eyebrow";

const FEATURES = [
  { label: "Talented People", icon: IconUsers },
  { label: "Proven Processes", icon: IconBulb },
  { label: "Real Business Impact", icon: IconChartBar },
] as const;

export function HeroSection() {
  return (
    <section className="overflow-x-hidden bg-white pb-12 pt-8 sm:pb-16 sm:pt-10 md:pb-24 md:pt-14">
      <Container>
        <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="hero-enter lg:col-span-5">
            <SectionEyebrow>People. Process. Progress.</SectionEyebrow>
            <h1 className="mt-4 font-display text-[clamp(2.25rem,5vw,4rem)] font-bold leading-[1.05] tracking-tight text-navy text-balance">
              People power{" "}
              <span className="text-green-strong">better business.</span>
            </h1>
            <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-slate sm:mt-5 md:text-lg">
              Dependable teams. Smarter operations. A trusted outsourcing
              partner helping you scale with confidence.
            </p>
            <div className="mt-7 flex w-full flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
              <Button
                size="lg"
                className="w-full sm:w-auto"
                nativeButton={false}
                render={<Link href="/contact" data-analytics="hero_primary_cta" />}
              >
                Let&apos;s Talk
                <IconArrowRight stroke={2} className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto"
                nativeButton={false}
                render={
                  <Link href="/#services" data-analytics="hero_secondary_cta" />
                }
              >
                Explore Our Services
              </Button>
            </div>
            <ul className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {FEATURES.map((item) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.label}
                    className="flex min-h-11 items-center gap-2 font-display text-sm font-semibold text-navy"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-soft-green text-green-strong">
                      <Icon stroke={1.75} className="size-4" />
                    </span>
                    {item.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="hero-enter-delay relative lg:col-span-7">
            <ResponsiveImageFrame
              src="/images/hero/beepa-team-hero.webp"
              alt="Beepa professionals collaborating in a bright office"
              priority
              className="aspect-[4/3] w-full md:aspect-[5/4] lg:min-h-[440px]"
              sizes="(max-width: 1024px) 100vw, 55vw"
              imageClassName="object-[center_30%] md:object-[70%_center]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-6 -right-4 flex size-32 items-center justify-center rounded-full bg-green text-center text-white shadow-[0_12px_40px_rgb(17_148_70/0.35)] sm:size-40 lg:size-48"
            >
              <p className="px-4 font-display text-[11px] font-semibold uppercase leading-tight tracking-[0.12em] sm:text-xs">
                Great People Build Brighter Tomorrow
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
