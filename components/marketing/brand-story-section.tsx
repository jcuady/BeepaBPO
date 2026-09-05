import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { ConnectedGrowthDecoration } from "@/components/beepa/connected-growth-decoration";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";

export function BrandStorySection() {
  return (
    <section className="relative overflow-hidden bg-white py-20 md:py-28">
      <ConnectedGrowthDecoration
        className="absolute -right-8 top-8 size-64 md:size-80"
        opacity={0.06}
      />
      <Container>
        <div className="max-w-2xl md:ml-0 lg:ml-[8%]">
          <SectionHeading>Built on Purpose. Growing Together.</SectionHeading>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-slate">
            <p>
              Beepa began in 2019 with a family vision: build something
              meaningful that could create lasting opportunity.
            </p>
            <p>
              That purpose grew beyond one family. It now includes the Filipino
              professionals who build their careers here and the clients who
              trust Beepa with their teams.
            </p>
            <p>
              Today we help businesses build dependable teams while creating
              work that respects people and relationships.
            </p>
            <p>
              Growth continues that original vision: credible, human, and ready
              for what comes next.
            </p>
          </div>
          <Link
            href="/about"
            className="mt-8 inline-flex min-h-11 items-center gap-1 font-display text-sm font-semibold text-green-strong hover:underline"
          >
            Learn about Beepa
            <IconArrowRight stroke={2} className="size-4" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
