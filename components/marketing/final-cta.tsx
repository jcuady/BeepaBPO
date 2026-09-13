import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { LimeArc } from "@/components/beepa/connected-growth-decoration";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";
import { Reveal } from "@/components/marketing/reveal";

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

export function FinalCTA() {
  return (
    <section className="relative overflow-x-clip bg-navy py-24 md:py-32">
      <LimeArc className="absolute -right-10 -top-10 size-56 md:size-72" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green/20 blur-[130px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: NOISE }}
      />
      <Container className="relative text-center">
        <Reveal>
          <SectionHeading className="text-white">
            Ready to build a stronger team?
          </SectionHeading>
          <p className="mx-auto mt-4 max-w-[48ch] text-base leading-relaxed text-white/75">
            Tell us what your business needs. We will help you build a
            dependable team with clear support behind it.
          </p>
          <div className="mt-9 flex w-full justify-center">
            <Button
              size="lg"
              className="group w-full max-w-sm gap-2 rounded-full bg-lime text-navy transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-white active:scale-[0.97] sm:w-auto"
              nativeButton={false}
              render={<Link href="/contact" data-analytics="final_cta" />}
            >
              Let&apos;s Talk
              <span className="flex size-7 items-center justify-center rounded-full bg-navy/10 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:scale-105">
                <IconArrowRight stroke={2} className="size-3.5" aria-hidden />
              </span>
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
