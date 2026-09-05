import Image from "next/image";
import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";

export function CareersBand() {
  return (
    <section className="bg-white py-20 md:py-28">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-center lg:gap-12">
          <div>
            <SectionHeading className="text-[clamp(1.75rem,3.5vw,2.5rem)]">
              Grow your career with Beepa
            </SectionHeading>
            <p className="mt-4 max-w-[48ch] text-base leading-relaxed text-slate">
              Join a team that treats opportunity, respect, and professional
              development as part of the work. Build a career that grows with
              the people you support.
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="mt-7 w-full sm:w-fit"
              nativeButton={false}
              render={<Link href="/careers" data-analytics="careers_viewed" />}
            >
              Explore Careers
              <IconArrowRight stroke={2} className="size-4" />
            </Button>
          </div>

          <div className="relative aspect-[16/10] overflow-hidden rounded-[16px] ring-1 ring-line lg:aspect-[16/9]">
            <Image
              src="https://picsum.photos/seed/beepa-careers-team/1600/900"
              alt="Beepa team members collaborating in the office"
              fill
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover object-center"
              unoptimized
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
