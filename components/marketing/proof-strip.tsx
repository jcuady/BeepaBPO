import Image from "next/image";
import { Container } from "@/components/beepa/container";

// ponytail: placeholder stats and testimonial. Replace with verified metrics + real client before launch.
const STATS = [
  { value: "500+", label: "Skilled professionals" },
  { value: "50+", label: "Happy clients" },
  { value: "98%", label: "Client satisfaction" },
  { value: "5+", label: "Years of steady growth" },
] as const;

export function ProofStrip() {
  return (
    <section className="bg-navy py-16 md:py-20">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-12">
          <ul className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {STATS.map((stat) => (
              <li key={stat.label} className="text-center sm:text-left">
                <p className="font-display text-[clamp(2rem,4vw,2.75rem)] font-bold leading-none text-white">
                  {stat.value}
                </p>
                <p className="mt-2 font-display text-sm font-medium leading-snug text-white/70">
                  {stat.label}
                </p>
              </li>
            ))}
          </ul>

          <figure className="rounded-[16px] bg-white p-6 shadow-[0_12px_40px_rgb(0_0_0/0.2)] sm:p-7">
            <blockquote className="text-base leading-relaxed text-ink">
              &ldquo;Beepa gave us a dependable team that felt like our own from
              day one. Communication is clear, work is consistent, and they
              genuinely care about our outcomes.&rdquo;
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              <span className="relative size-11 shrink-0 overflow-hidden rounded-full bg-mist">
                <Image
                  src="https://picsum.photos/seed/maria-santos-ops-director/96/96"
                  alt="Maria Santos"
                  fill
                  sizes="44px"
                  className="object-cover"
                  unoptimized
                />
              </span>
              <span>
                <p className="font-display text-sm font-semibold text-navy">
                  Maria Santos
                </p>
                <p className="text-sm text-slate">
                  Operations Director, BrightPlan Solutions
                </p>
              </span>
            </figcaption>
          </figure>
        </div>
      </Container>
    </section>
  );
}
