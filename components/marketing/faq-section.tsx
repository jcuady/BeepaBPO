import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";

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

export function FAQSection() {
  return (
    <section className="bg-white py-20 md:py-28">
      <Container>
        <div className="mx-auto max-w-3xl">
          <SectionHeading>Questions teams ask before they start</SectionHeading>
          <Accordion className="mt-10">
            {FAQ_ITEMS.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Container>
    </section>
  );
}
