import Link from "next/link";
import {
  IconArrowRight,
  IconHeartHandshake,
  IconRefresh,
  IconTrendingUp,
} from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";

/** Honest proof band — no fabricated stats or testimonials. */
const PRINCIPLES = [
  {
    word: "People",
    line: "Dependable outsourced teams who treat your business like their own.",
    icon: IconHeartHandshake,
  },
  {
    word: "Process",
    line: "Clear operating rhythms that keep clients and staff aligned.",
    icon: IconRefresh,
  },
  {
    word: "Progress",
    line: "A platform and partnership built to move you forward.",
    icon: IconTrendingUp,
  },
] as const;

export function ProofStrip() {
  return (
    <section className="border-y border-line/70 bg-mist py-20 md:py-24">
      <Container>
        <Reveal>
          <p className="text-center font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-green-strong">
            How we work
          </p>
        </Reveal>

        <div className="mt-10 grid gap-y-10 sm:grid-cols-3 sm:gap-y-0">
          {PRINCIPLES.map((principle, index) => {
            const Icon = principle.icon;
            return (
              <Reveal
                key={principle.word}
                delay={index * 100}
                className="group sm:border-l sm:border-line sm:px-8 sm:first:border-l-0 sm:first:pl-0 sm:last:pr-0 lg:px-10"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-white text-green-strong ring-1 ring-green-strong/10 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 [@media(hover:hover)_and_(pointer:fine)]:group-hover:-rotate-6">
                    <Icon stroke={1.5} className="size-5" aria-hidden />
                  </span>
                  <h2 className="font-display text-[clamp(1.6rem,2.6vw,2.1rem)] font-bold tracking-tight text-navy transition-colors duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-green-strong">
                    {principle.word}
                  </h2>
                </div>
                <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-slate">
                  {principle.line}
                </p>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={200}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <Button
              className="group min-h-11 gap-2 rounded-full bg-green-strong text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-green active:scale-[0.97]"
              nativeButton={false}
              render={<Link href="/contact" />}
            >
              Build your team
              <span className="flex size-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
                <IconArrowRight stroke={2} className="size-3" aria-hidden />
              </span>
            </Button>
            <Button
              variant="outline"
              className="min-h-11 rounded-full border-navy/20 bg-transparent text-navy transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-navy/35 hover:bg-white active:scale-[0.97]"
              nativeButton={false}
              render={<Link href="/case-studies" />}
            >
              Case studies
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
