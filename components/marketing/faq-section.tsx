import Link from "next/link";
import { IconArrowUpRight, IconMessages } from "@tabler/icons-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Container } from "@/components/beepa/container";
import { SectionEyebrow } from "@/components/beepa/section-eyebrow";
import { SectionHeading } from "@/components/beepa/section-heading";
import { Reveal } from "@/components/marketing/reveal";

export const FAQ_ITEMS = [
  {
    q: "What roles can Beepa help us hire?",
    a: "Beepa supports customer support, back office, virtual assistants, sales support, and specialized roles shaped around your workflows.",
  },
  {
    q: "How does Beepa select professionals?",
    a: "We define requirements with you, source candidates who fit the brief, and involve you in interviews before any placement.",
  },
  {
    q: "Can Beepa support US business hours?",
    a: "Yes. Schedules are planned around how your business operates, including US hours where needed.",
  },
  {
    q: "How does onboarding work?",
    a: "Once a hire is confirmed, Beepa supports a structured start so your team can begin work with clear expectations and tools.",
  },
  {
    q: "Can we scale our team later?",
    a: "Yes. Beepa is built for flexible growth so teams and workflows can expand as your needs change.",
  },
  {
    q: "How do clients communicate with Beepa?",
    a: "You work with Beepa through dedicated support channels, and approved clients can use the Beepa platform for visibility and requests.",
  },
  {
    q: "How do we start?",
    a: "Share what your business needs. We begin with discovery, then define requirements and move into sourcing together.",
  },
] as const;

export function FAQSection({
  items = FAQ_ITEMS,
}: {
  items?: readonly { q: string; a: string }[];
}) {
  return (
    <section className="bg-white py-24 md:py-32">
      <Container>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <Reveal>
                <SectionEyebrow>FAQs</SectionEyebrow>
                <SectionHeading className="mt-3">
                  Questions teams ask before they start
                </SectionHeading>
                <p className="mt-4 max-w-[44ch] text-base leading-relaxed text-slate">
                  Straight answers about roles, sourcing, schedules, and how a
                  Beepa engagement actually works.
                </p>
              </Reveal>

              <Reveal delay={120}>
                <Link
                  href="/contact"
                  className="group mt-8 flex items-center gap-4 rounded-[20px] bg-mist p-5 ring-1 ring-line transition-[background-color,box-shadow] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-soft-green [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_16px_40px_-28px_rgb(31_32_88/0.35)]"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-green-strong ring-1 ring-green-strong/10">
                    <IconMessages stroke={1.5} className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-sm font-bold text-navy">
                      Still have questions?
                    </span>
                    <span className="mt-0.5 block text-sm text-slate">
                      Talk to our team — we reply within one business day.
                    </span>
                  </span>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy text-white transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:rotate-45 [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-green-strong">
                    <IconArrowUpRight stroke={1.75} className="size-4" aria-hidden />
                  </span>
                </Link>
              </Reveal>
            </div>
          </div>

          <Reveal delay={80} className="lg:col-span-7">
            <Accordion>
              {items.map((item) => (
                <AccordionItem key={item.q} value={item.q}>
                  <AccordionTrigger className="py-6 text-lg tracking-tight">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="max-w-[62ch]">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
