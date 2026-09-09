import Link from "next/link";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconHeartbeat,
  IconRoute,
  IconTopologyStar3,
} from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";
import { BRAND } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Brand triad — People / Process / Progress.
 * Asymmetric editorial layout (not a 3-column feature row).
 */
const TRIAD = [
  {
    word: "People",
    index: "01",
    line: "Talent we search for, place on your team, and pay with care — people who treat your work like their own.",
    icon: IconHeartbeat,
    tone: "mist" as const,
  },
  {
    word: "Process",
    index: "02",
    line: "Clear briefs, shortlists, and placement rhythms so clients and staff stay aligned from day one.",
    icon: IconRoute,
    tone: "white" as const,
  },
  {
    word: "Progress",
    index: "03",
    line: "A partnership built to grow with you — more roles when you need them, without restarting hiring from zero.",
    icon: IconTopologyStar3,
    tone: "navy" as const,
  },
] as const;

const TONE = {
  mist: {
    shell: "bg-mist ring-1 ring-line",
    word: "text-navy",
    line: "text-slate",
    index: "text-navy/[0.06]",
    plate: "bg-white text-green-strong ring-1 ring-green-strong/10",
  },
  white: {
    shell: "bg-white ring-1 ring-line",
    word: "text-navy",
    line: "text-slate",
    index: "text-navy/[0.06]",
    plate: "bg-soft-green text-green-strong ring-1 ring-green-strong/10",
  },
  navy: {
    shell: "bg-navy text-white shadow-[0_28px_56px_-36px_rgb(31_32_88/0.65)]",
    word: "text-white",
    line: "text-white/70",
    index: "text-white/[0.08]",
    plate: "bg-white/10 text-lime ring-1 ring-white/15",
  },
} as const;

export function ProofStrip() {
  const [people, process, progress] = TRIAD;

  return (
    <section
      data-proof-strip
      className="relative overflow-hidden border-y border-line/70 bg-white py-24 md:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-24 size-[360px] rounded-full bg-green/8 blur-[110px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-10 size-[300px] rounded-full bg-lime/12 blur-[100px]"
      />

      <Container className="relative">
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-12">
            <div className="lg:col-span-7">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-green-strong">
                How we work
              </p>
              <h2 className="mt-3 max-w-[16ch] font-display text-[clamp(2rem,4.2vw,3.25rem)] font-bold leading-[1.08] tracking-tight text-navy text-balance">
                {BRAND.tagline}
              </h2>
              <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-slate">
                Three commitments behind every placement — not a slogan row,
                the operating model.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
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
                className="min-h-11 rounded-full border-navy/20 bg-transparent text-navy transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-navy/35 hover:bg-mist active:scale-[0.97]"
                nativeButton={false}
                render={<Link href="/case-studies" />}
              >
                Case studies
              </Button>
            </div>
          </div>
        </Reveal>

        {/* Asymmetric bento: 7 + 5 on row one, full-bleed Progress */}
        <div className="mt-14 grid gap-5 md:mt-16 md:grid-cols-12 md:gap-6">
          <Reveal className="md:col-span-7" delay={60}>
            <PrinciplePanel principle={people} featured />
          </Reveal>
          <Reveal className="md:col-span-5" delay={120}>
            <PrinciplePanel principle={process} />
          </Reveal>
          <Reveal className="md:col-span-12" delay={180}>
            <PrinciplePanel principle={progress} wide />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function PrinciplePanel({
  principle,
  featured = false,
  wide = false,
}: {
  principle: (typeof TRIAD)[number];
  featured?: boolean;
  wide?: boolean;
}) {
  const tone = TONE[principle.tone];
  const Icon = principle.icon;

  return (
    <article
      className={cn(
        "group relative flex h-full overflow-hidden rounded-[28px] transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
        tone.shell,
        wide
          ? "flex-col gap-8 p-8 sm:flex-row sm:items-end sm:justify-between sm:p-10 md:p-11"
          : "flex-col p-8 md:p-9",
        featured && "min-h-[280px] md:min-h-[320px]",
        "[@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-4 -top-6 font-display text-[7.5rem] font-extrabold leading-none tracking-tighter md:text-[9rem]",
          tone.index,
        )}
      >
        {principle.index}
      </span>

      <div className={cn("relative", wide && "max-w-[52ch]")}>
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-[12px]",
            tone.plate,
          )}
        >
          <Icon stroke={1.5} className="size-5" aria-hidden />
        </span>
        <h3
          className={cn(
            "mt-6 font-display font-bold tracking-tight",
            featured || wide
              ? "text-[clamp(2rem,3.5vw,2.75rem)]"
              : "text-[clamp(1.65rem,2.5vw,2rem)]",
            tone.word,
          )}
        >
          {principle.word}
        </h3>
        <p
          className={cn(
            "mt-3 text-base leading-relaxed",
            featured || wide ? "max-w-[44ch]" : "max-w-[34ch]",
            tone.line,
          )}
        >
          {principle.line}
        </p>
      </div>

      {wide ? (
        <Link
          href="/why-beepa"
          className="relative inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-full bg-lime px-5 text-sm font-semibold text-navy transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-white active:scale-[0.97] sm:self-end"
        >
          Why Beepa
          <IconArrowUpRight stroke={2} className="size-3.5" aria-hidden />
        </Link>
      ) : null}
    </article>
  );
}
