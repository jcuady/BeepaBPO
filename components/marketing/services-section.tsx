import Link from "next/link";
import {
  IconArrowRight,
  IconChartBar,
  IconHeadset,
  IconFileDescription,
  IconUsers,
} from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { SectionEyebrow } from "@/components/beepa/section-eyebrow";
import { SectionHeading } from "@/components/beepa/section-heading";

const SERVICES = [
  {
    title: "Customer Support",
    description:
      "Dependable frontline support that keeps customers informed and issues resolved.",
    icon: IconHeadset,
  },
  {
    title: "Back Office Support",
    description:
      "Accurate operational work that frees your team to focus on growth.",
    icon: IconFileDescription,
  },
  {
    title: "Virtual Assistants",
    description:
      "Administrative partners who keep calendars, inboxes, and priorities moving.",
    icon: IconUsers,
  },
  {
    title: "Sales Support",
    description:
      "Research, outreach, and pipeline support that extends your revenue team.",
    icon: IconChartBar,
  },
] as const;

export function ServicesSection() {
  return (
    <section id="services" className="scroll-mt-24 bg-white py-20 md:py-28">
      <Container>
        <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <SectionEyebrow>Our Services</SectionEyebrow>
            <SectionHeading className="mt-3">
              Outsourcing solutions for a stronger tomorrow.
            </SectionHeading>
          </div>
          <div>
            <p className="text-base leading-relaxed text-slate">
              From customer support to back office operations, Beepa provides
              dependable teams that integrate with your workflow and grow with
              your business.
            </p>
            <Link
              href="/services"
              className="mt-4 inline-flex min-h-11 items-center gap-1 font-display text-sm font-semibold text-green-strong hover:underline"
            >
              View all services
              <IconArrowRight stroke={2} className="size-4" />
            </Link>
          </div>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <article
                key={service.title}
                className="group flex flex-col rounded-[16px] border border-line bg-white p-6 transition-all hover:border-green/30 hover:shadow-[0_8px_30px_rgb(23_24_43/0.06)]"
              >
                <span className="flex size-12 items-center justify-center rounded-[12px] bg-soft-green text-green-strong">
                  <Icon stroke={1.75} className="size-6" />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold text-navy">
                  {service.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate">
                  {service.description}
                </p>
                <Link
                  href="/services"
                  aria-label={`Learn more about ${service.title}`}
                  className="mt-6 inline-flex min-h-11 items-center justify-self-end"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-navy text-white transition-colors group-hover:bg-green-strong">
                    <IconArrowRight stroke={2} className="size-4" />
                  </span>
                </Link>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
