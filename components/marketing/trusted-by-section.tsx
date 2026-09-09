"use client";

import { useId, useState } from "react";
import { IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";

/** Honest focus areas — no fabricated client logos. */
const FOCUS = [
  "Customer support",
  "Back-office ops",
  "Finance support",
  "Recruitment",
  "Virtual assistants",
  "Process delivery",
  "People operations",
  "Quality assurance",
] as const;

function MarqueeTrack({
  id,
  decorative = false,
}: {
  id?: string;
  decorative?: boolean;
}) {
  return (
    <ul
      id={id}
      className="flex shrink-0 items-center gap-10 px-5 sm:gap-14 sm:px-8"
      aria-hidden={decorative ? true : undefined}
    >
      {FOCUS.map((name) => (
        <li
          key={`${decorative ? "dup" : "a"}-${name}`}
          className="flex shrink-0 items-center gap-10 sm:gap-14"
        >
          <span className="font-display text-sm font-semibold tracking-tight text-navy/75 whitespace-nowrap sm:text-[15px]">
            {name}
          </span>
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full bg-lime/80"
          />
        </li>
      ))}
    </ul>
  );
}

export function TrustedBySection() {
  const labelId = useId();
  const [paused, setPaused] = useState(false);

  return (
    <section
      className="border-y border-line/70 bg-[#F4F6F8] py-5 md:py-6"
      aria-labelledby={labelId}
    >
      <Container>
        <div className="flex items-center gap-4 sm:gap-6">
          <p
            id={labelId}
            className="shrink-0 font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-slate md:text-[11px]"
          >
            Built for growing teams
          </p>

          <div className="relative min-w-0 flex-1">
            <div
              className="trust-marquee-mask relative overflow-hidden"
              data-paused={paused ? "true" : "false"}
            >
              <div className="trust-marquee-track flex w-max">
                <MarqueeTrack />
                <MarqueeTrack decorative />
              </div>
            </div>
          </div>

          <button
            type="button"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-navy ring-1 ring-line transition-[transform,background-color,color] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-soft-green hover:text-green-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-strong/40 active:scale-[0.97]"
            aria-pressed={paused}
            aria-label={paused ? "Play focus areas carousel" : "Pause focus areas carousel"}
            onClick={() => setPaused((v) => !v)}
          >
            {paused ? (
              <IconPlayerPlay stroke={1.5} className="size-4" aria-hidden />
            ) : (
              <IconPlayerPause stroke={1.5} className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </Container>
    </section>
  );
}
