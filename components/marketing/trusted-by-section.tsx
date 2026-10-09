import {
  IconChartBar,
  IconClipboardCheck,
  IconFileDescription,
  IconHeadset,
  IconRoute,
  IconUserSearch,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";
import type { TablerIcon } from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { EyebrowPill } from "@/components/marketing/landing-primitives";

/** Honest focus areas — no fabricated client logos. */
const FOCUS = [
  { label: "Customer support", icon: IconHeadset },
  { label: "Back-office ops", icon: IconFileDescription },
  { label: "Finance support", icon: IconChartBar },
  { label: "Recruitment", icon: IconUserSearch },
  { label: "Virtual assistants", icon: IconUsers },
  { label: "Process delivery", icon: IconRoute },
  { label: "People operations", icon: IconUsersGroup },
  { label: "Quality assurance", icon: IconClipboardCheck },
] as const satisfies ReadonlyArray<{ label: string; icon: TablerIcon }>;

function MarqueeTrack({ decorative = false }: { decorative?: boolean }) {
  return (
    <ul
      className="flex shrink-0 items-center px-3 sm:px-5"
      aria-hidden={decorative ? true : undefined}
    >
      {FOCUS.map((item) => {
        const Icon = item.icon;
        return (
          <li
            key={`${decorative ? "dup" : "a"}-${item.label}`}
            className="flex shrink-0 items-center"
          >
            <span className="flex items-center gap-2.5 px-4 sm:gap-3 sm:px-6">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-white text-green-strong ring-1 ring-line">
                <Icon stroke={1.5} className="size-4" aria-hidden />
              </span>
              <span className="font-display text-[13px] font-semibold tracking-tight text-navy whitespace-nowrap sm:text-[15px]">
                {item.label}
              </span>
            </span>
            <span
              aria-hidden
              className="h-4 w-px shrink-0 bg-navy/10"
            />
          </li>
        );
      })}
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
      className="relative overflow-x-clip border-y border-line/80 bg-mist"
      aria-label="Built for growing teams"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-[3px] bg-lime md:block"
      />

      <Container>
        <div className="flex flex-col gap-4 py-6 sm:py-7 md:flex-row md:items-center md:gap-8 md:py-8 lg:gap-10">
          {/* Eyebrow pill replaces bare uppercase label — visually consistent
              with the rest of the redesigned landing page. */}
          <div className="shrink-0">
            <EyebrowPill>Built for growing teams</EyebrowPill>
          </div>

          <div
            className="hidden h-9 w-px shrink-0 bg-navy/10 md:block"
            aria-hidden
          />

          <div
            className="trust-marquee-mask relative flex min-h-11 min-w-0 flex-1 items-center overflow-hidden"
            data-marquee="trust"
            tabIndex={0}
            aria-label="Focus areas. Pause by hovering or focusing this region."
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