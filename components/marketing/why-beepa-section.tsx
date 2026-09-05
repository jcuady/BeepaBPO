import Image from "next/image";
import Link from "next/link";
import {
  IconHeartHandshake,
  IconLock,
  IconPlant,
  IconUsersGroup,
  IconArrowRight,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";
import { SectionEyebrow } from "@/components/beepa/section-eyebrow";
import { SectionHeading } from "@/components/beepa/section-heading";

const VALUES = [
  {
    title: "People-First",
    description: "Professionals treated as partners, not seats to fill.",
    icon: IconUsersGroup,
  },
  {
    title: "Reliable & Secure",
    description: "Clear processes, accountable delivery, careful handling.",
    icon: IconLock,
  },
  {
    title: "Built for Growth",
    description: "Teams and workflows that expand as your needs change.",
    icon: IconPlant,
  },
  {
    title: "A Culture That Cares",
    description: "Support that continues after hiring, for clients and teams.",
    icon: IconHeartHandshake,
  },
] as const;

export function WhyBeepaSection() {
  return (
    <section id="why-beepa" className="scroll-mt-24 bg-mist py-20 md:py-28">
      <Container>
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-8">
          <div className="flex flex-col">
            <SectionEyebrow>Why Beepa</SectionEyebrow>
            <SectionHeading className="mt-3">
              A partner invested in your success.
            </SectionHeading>
            <p className="mt-4 text-base leading-relaxed text-slate">
              Beepa stays involved after placement. You get capable people,
              clear communication, and a relationship built for the long term.
            </p>
            <Button
              className="mt-6 w-fit"
              nativeButton={false}
              render={<Link href="/about" />}
            >
              Discover the Beepa Difference
              <IconArrowRight stroke={2} className="size-4" />
            </Button>
          </div>

          <ul className="grid grid-cols-2 gap-4 self-center">
            {VALUES.map((value) => {
              const Icon = value.icon;
              return (
                <li
                  key={value.title}
                  className="rounded-[16px] border border-line bg-white p-5"
                >
                  <span className="flex size-10 items-center justify-center rounded-[10px] bg-soft-green text-green-strong">
                    <Icon stroke={1.75} className="size-5" />
                  </span>
                  <h3 className="mt-4 font-display text-base font-semibold text-navy">
                    {value.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate">
                    {value.description}
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="relative min-h-[320px] overflow-hidden rounded-[16px] ring-1 ring-line lg:min-h-[440px]">
            <Image
              src="/images/sections/people-make-progress.png"
              alt="Beepa customer support agent wearing a headset"
              fill
              sizes="(max-width: 1024px) 100vw, 33vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/20 to-transparent" />
            <p
              className="absolute left-5 top-5 font-serif text-2xl italic text-white drop-shadow-[0_2px_8px_rgb(0_0_0/0.4)]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              People Make Progress
            </p>
            <div className="absolute bottom-5 left-5 right-5 rounded-[12px] bg-navy/90 p-4 backdrop-blur-sm">
              <p className="font-display text-base font-semibold leading-snug text-white">
                &ldquo;Behind every great business is a team that cares.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
