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

function MarqueeTrack({ decorative = false }: { decorative?: boolean }) {
  return (
    <ul
      className="flex shrink-0 items-center gap-10 px-5 sm:gap-14 sm:px-8"
      aria-hidden={decorative ? true : undefined}
    >
      {FOCUS.map((name) => (
        <li
          key={`${decorative ? "dup" : "a"}-${name}`}
          className="flex shrink-0 items-center gap-10 sm:gap-14"
        >
          <span className="font-display text-sm font-semibold tracking-tight text-navy/70 whitespace-nowrap sm:text-[15px]">
            {name}
          </span>
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full bg-lime"
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * Infinite focus-area marquee — CSS-only.
 * Two identical tracks; translateX(-50%) loops forever.
 * Pauses on hover / keyboard focus-within (WCAG 2.2.2 without a control button).
 */
export function TrustedBySection() {
  return (
    <section
      className="border-y border-line/70 bg-[#F4F6F8] py-5 md:py-6"
      aria-label="Built for growing teams"
    >
      <Container>
        <div className="flex items-center gap-5 sm:gap-8">
          <p className="shrink-0 font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-slate md:text-[11px]">
            Built for growing teams
          </p>

          <div
            className="trust-marquee-mask relative min-w-0 flex-1 overflow-hidden"
            data-marquee="trust"
          >
            <div
              className="trust-marquee-track flex w-max will-change-transform"
              data-marquee-engine="css-infinite"
            >
              <MarqueeTrack />
              <MarqueeTrack decorative />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
