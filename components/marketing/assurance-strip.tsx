import { Container } from "@/components/beepa/container";
import { IconCheck } from "@tabler/icons-react";

/**
 * Assurance strip — four one-line proofs, immediately under the hero.
 *
 * The reference places this between the hero and section 01. It answers the
 * question a buyer has before they have read a single section — "what actually
 * do I get?" — in one scan, and it costs 27px of padding to do it.
 *
 * Rendered as a plain list with the tick as a real `aria-hidden` glyph rather
 * than an icon component: the tick is decorative here, the text carries the
 * meaning, and a decorative glyph is better expressed as text than as a node
 * that has to be hidden from assistive tech.
 */
const ASSURANCES = [
  "Dedicated Filipino talent",
  "Your hours. Your workflows.",
  "Web & mobile visibility",
  "Transparent payroll & performance",
] as const;

export function AssuranceStrip() {
  return (
    <div className="border-b border-line bg-white">
      <Container>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-4 py-6 sm:grid-cols-2 lg:grid-cols-4 lg:py-7">
          {ASSURANCES.map((text) => (
            <li key={text} className="flex items-center gap-2.5">
              <IconCheck
                stroke={2.5}
                aria-hidden="true"
                className="size-3.5 shrink-0 text-green-strong"
              />
              <span className="font-display text-[13px] font-medium text-navy">
                {text}
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </div>
  );
}