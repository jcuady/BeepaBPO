import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { LimeArc } from "@/components/beepa/connected-growth-decoration";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-navy py-20 md:py-24">
      <LimeArc className="absolute -right-10 -top-10 size-56 md:size-72" />
      <Container className="relative text-center">
        <SectionHeading className="text-white">
          Ready to build a stronger team?
        </SectionHeading>
        <p className="mx-auto mt-4 max-w-[48ch] text-base text-white/75">
          Tell us what your business needs. We will help you build a dependable
          team with clear support behind it.
        </p>
        <div className="mt-8 flex w-full justify-center">
          <Button
            size="lg"
            className="w-full max-w-sm sm:w-auto"
            nativeButton={false}
            render={<Link href="/contact" data-analytics="final_cta" />}
          >
            Let&apos;s Talk
            <IconArrowRight stroke={2} className="size-4" />
          </Button>
        </div>
      </Container>
    </section>
  );
}
