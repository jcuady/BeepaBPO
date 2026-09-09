import Link from "next/link";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconChartBar,
  IconHeadset,
  IconFileDescription,
  IconUsers,
} from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { SectionEyebrow } from "@/components/beepa/section-eyebrow";
import { SectionHeading } from "@/components/beepa/section-heading";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

const SERVICES = [
  {
    title: "Customer Support",
    description:
      "Dependable frontline support that keeps customers informed and issues resolved — across voice, chat, and email, in your hours and your voice.",
    icon: IconHeadset,
    span: "md:col-span-7",
    tone: "navy",
  },
  {
    title: "Back Office Support",
    description:
      "Accurate operational work that frees your team to focus on growth.",
    icon: IconFileDescription,
    span: "md:col-span-5",
    tone: "mist",
  },
  {
    title: "Virtual Assistants",
    description:
      "Administrative partners who keep calendars, inboxes, and priorities moving.",
    icon: IconUsers,
    span: "md:col-span-5",
    tone: "green",
  },
  {
    title: "Sales Support",
    description:
      "Research, outreach, and pipeline support that extends your revenue team — without adding fixed headcount.",
    icon: IconChartBar,
    span: "md:col-span-7",
    tone: "white",
  },
] as const;

const TONES = {
  navy: {
    card: "bg-navy text-white shadow-[0_24px_48px_-32px_rgb(31_32_88/0.55)]",
    ghost: "text-white/[0.07]",
    plate: "bg-white/10 text-lime ring-1 ring-white/15",
    title: "text-white",
    body: "text-white/70",
    arrow:
      "bg-lime text-navy [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-white",
  },
  mist: {
    card: "bg-mist ring-1 ring-line",
    ghost: "text-navy/[0.05]",
    plate: "bg-white text-green-strong ring-1 ring-green-strong/10",
    title: "text-navy",
    body: "text-slate",
    arrow:
      "bg-navy text-white [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-green-strong",
  },
  green: {
    card: "bg-soft-green ring-1 ring-green-strong/10",
    ghost: "text-green-strong/[0.07]",
    plate: "bg-white text-green-strong ring-1 ring-green-strong/10",
    title: "text-navy",
    body: "text-slate",
    arrow:
      "bg-navy text-white [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-green-strong",
  },
  white: {
    card: "bg-white ring-1 ring-line",
    ghost: "text-navy/[0.05]",
    plate: "bg-soft-green text-green-strong ring-1 ring-green-strong/10",
    title: "text-navy",
    body: "text-slate",
    arrow:
      "bg-navy text-white [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-green-strong",
  },
} as const;

export function ServicesSection() {
  return (
    <section id="services" className="scroll-mt-24 bg-white py-24 md:py-32">
      <Container>
        <Reveal>
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
                className="group mt-4 inline-flex min-h-11 items-center gap-1.5 font-display text-sm font-semibold text-green-strong"
              >
                View all services
                <IconArrowRight
                  stroke={2}
                  className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          </div>
        </Reveal>

        <div className="mt-14 grid grid-flow-dense grid-cols-1 gap-5 md:grid-cols-12">
          {SERVICES.map((service, index) => {
            const Icon = service.icon;
            const tone = TONES[service.tone];
            return (
              <Reveal
                key={service.title}
                delay={index * 90}
                className={service.span}
              >
                <article
                  className={cn(
                    "group relative flex h-full min-h-[240px] flex-col overflow-hidden rounded-[24px] p-7 transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] sm:p-8 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1",
                    tone.card,
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute -right-3 -top-7 select-none font-display text-[7rem] font-extrabold leading-none tracking-tighter",
                      tone.ghost,
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span
                    className={cn(
                      "flex size-12 items-center justify-center rounded-[14px] transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 [@media(hover:hover)_and_(pointer:fine)]:group-hover:-rotate-3",
                      tone.plate,
                    )}
                  >
                    <Icon stroke={1.5} className="size-6" aria-hidden />
                  </span>

                  <h3
                    className={cn(
                      "mt-6 font-display text-xl font-bold tracking-tight",
                      tone.title,
                    )}
                  >
                    {service.title}
                  </h3>
                  <p
                    className={cn(
                      "mt-2 max-w-[46ch] flex-1 text-sm leading-relaxed",
                      tone.body,
                    )}
                  >
                    {service.description}
                  </p>

                  <Link
                    href="/services"
                    aria-label={`Learn more about ${service.title}`}
                    className="mt-8 inline-flex min-h-11 items-center self-start"
                  >
                    <span
                      className={cn(
                        "flex size-10 items-center justify-center rounded-full transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:rotate-45",
                        tone.arrow,
                      )}
                    >
                      <IconArrowUpRight stroke={1.75} className="size-4" />
                    </span>
                  </Link>
                </article>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
