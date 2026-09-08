import Link from "next/link";
import { Container } from "@/components/beepa/container";
import { Button } from "@/components/ui/button";

/** Honest proof band — no fabricated stats or testimonials. */
export function ProofStrip() {
  return (
    <section className="bg-navy py-16 md:py-20">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
            How we work
          </p>
          <h2 className="mt-3 font-display text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-tight text-white">
            People. Process. Progress.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/75">
            Dependable outsourced teams, clear operating rhythms, and a platform
            that keeps clients and staff aligned — without inventing vanity
            metrics.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              className="min-h-11 bg-green-strong text-white hover:bg-green"
              nativeButton={false}
              render={<Link href="/contact" />}
            >
              Build your team
            </Button>
            <Button
              variant="outline"
              className="min-h-11 border-white/30 bg-transparent text-white hover:bg-white/10"
              nativeButton={false}
              render={<Link href="/case-studies" />}
            >
              Case studies
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
