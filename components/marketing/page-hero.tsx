import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageHeroProps = {
  eyebrow: string;
  title: React.ReactNode;
  description: React.ReactNode;
  /** Optional right-column notes (bullets or aside). */
  aside?: React.ReactNode;
  cta?: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
  className?: string;
};

/**
 * Shared marketing page hero — asymmetric split, brand mist field, single CTA group.
 * Matches contact / homepage rhythm without repeating contact-form layout.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  aside,
  cta,
  secondaryCta,
  className,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-x-clip border-b border-line/70 bg-mist/50 py-16 md:py-24",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-0 size-[320px] rounded-full bg-green/10 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 size-[280px] rounded-full bg-lime/15 blur-[90px]"
      />
      <Container className="relative">
        <div
          className={cn(
            "grid gap-10 lg:items-end",
            aside ? "lg:grid-cols-12 lg:gap-12" : "lg:grid-cols-12",
          )}
        >
          <div className={aside ? "lg:col-span-7" : "lg:col-span-8"}>
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-green-strong">
              {eyebrow}
            </p>
            <SectionHeading
              as="h1"
              className="mt-4 max-w-[18ch] text-[clamp(2rem,4vw,3.15rem)]"
            >
              {title}
            </SectionHeading>
            <div className="mt-5 max-w-[48ch] text-base leading-relaxed text-slate">
              {description}
            </div>
            {(cta || secondaryCta) && (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {cta ? (
                  <Button
                    className="group min-h-11 gap-2 rounded-full bg-green-strong text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-green active:scale-[0.97]"
                    nativeButton={false}
                    render={<Link href={cta.href} />}
                  >
                    {cta.label}
                    <span className="flex size-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
                      <IconArrowRight
                        stroke={2}
                        className="size-3"
                        aria-hidden
                      />
                    </span>
                  </Button>
                ) : null}
                {secondaryCta ? (
                  <Button
                    variant="outline"
                    className="min-h-11 rounded-full border-navy/20 bg-transparent text-navy transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-navy/35 hover:bg-white active:scale-[0.97]"
                    nativeButton={false}
                    render={<Link href={secondaryCta.href} />}
                  >
                    {secondaryCta.label}
                  </Button>
                ) : null}
              </div>
            )}
          </div>
          {aside ? (
            <div className="lg:col-span-5 lg:justify-self-end lg:pb-1">
              {aside}
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
