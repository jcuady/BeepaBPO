import {
  IconCalendarCheck,
  IconChartLine,
  IconClockHour4,
  IconMessages,
  IconTicket,
} from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { SectionEyebrow } from "@/components/beepa/section-eyebrow";
import { SectionHeading } from "@/components/beepa/section-heading";

const CAPABILITIES = [
  { label: "Attendance", icon: IconCalendarCheck },
  { label: "Timesheets", icon: IconClockHour4 },
  { label: "Reports", icon: IconChartLine },
  { label: "Requests", icon: IconTicket },
  { label: "Communication", icon: IconMessages },
] as const;

export function PlatformSection() {
  return (
    <section className="bg-mist py-20 md:py-28">
      <Container>
        <div className="mx-auto max-w-3xl text-left md:text-center">
          <SectionEyebrow className="md:justify-center">
            The Beepa platform
          </SectionEyebrow>
          <SectionHeading className="mt-4">
            Your team. Clearer visibility.
          </SectionHeading>
          <p className="mt-4 text-base leading-relaxed text-slate md:mx-auto md:max-w-[58ch]">
            Approved Beepa clients can view their assigned workforce,
            attendance, timesheets, reports, requests, and communication from
            one place. The platform supports the service. It is not the product.
          </p>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {CAPABILITIES.map((item, index) => {
            const Icon = item.icon;
            return (
              <li key={item.label} className="relative">
                {index < CAPABILITIES.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute top-7 right-[-0.5rem] hidden h-px w-[calc(100%-3.5rem)] translate-x-full bg-line lg:block"
                  />
                )}
                <div className="flex items-center gap-3 rounded-[12px] border border-line bg-white p-4 lg:flex-col lg:items-start lg:gap-4 lg:p-5">
                  <span className="flex size-11 items-center justify-center rounded-full bg-soft-green text-green">
                    <Icon stroke={1.75} className="size-5" />
                  </span>
                  <p className="font-display text-sm font-semibold text-navy">
                    {item.label}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
