import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";

const STEPS = [
  {
    title: "Discovery",
    body: "We learn how your business works and what success looks like.",
  },
  {
    title: "Requirements",
    body: "Roles, skills, schedules, and tools are defined with clarity.",
  },
  {
    title: "Talent sourcing",
    body: "Beepa identifies professionals who fit the brief.",
  },
  {
    title: "Interview",
    body: "You meet shortlisted candidates before any placement.",
  },
  {
    title: "Hiring",
    body: "We finalize selection and prepare the working relationship.",
  },
  {
    title: "Onboarding",
    body: "Your team starts with structured support from day one.",
  },
  {
    title: "Ongoing support",
    body: "Beepa stays involved as your team and needs evolve.",
  },
] as const;

export function ProcessTimeline() {
  return (
    <section className="bg-white py-20 md:py-28">
      <Container>
        <SectionHeading className="max-w-xl">How it works</SectionHeading>
        <p className="mt-4 max-w-[52ch] text-base text-slate">
          A clear path from first conversation to a supported, working team.
        </p>

        <ol className="relative mt-12 space-y-0">
          <svg
            aria-hidden
            className="pointer-events-none absolute top-3 bottom-3 left-[15px] hidden w-0.5 overflow-visible md:block"
            preserveAspectRatio="none"
          >
            <line
              className="process-line"
              x1="1"
              y1="0"
              x2="1"
              y2="100%"
              stroke="#119446"
              strokeWidth="2"
              pathLength="1"
            />
          </svg>

          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative grid gap-3 border-b border-line py-6 last:border-b-0 md:grid-cols-[3rem_1fr] md:gap-6"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-soft-green font-display text-sm font-bold text-green-strong ring-4 ring-white">
                {index + 1}
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold text-navy">
                  {step.title}
                </h3>
                <p className="mt-1 max-w-[60ch] text-base text-slate">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
