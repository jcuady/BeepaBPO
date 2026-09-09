import { Container } from "@/components/beepa/container";

/** Visual trust strip matching marketing mockup — illustrative brand names for layout. */
const COMPANIES = [
  "Nexora",
  "CloudPeak",
  "VertexOps",
  "BrightPath",
  "ScaleForge",
  "NovaCore",
] as const;

export function TrustedBySection() {
  return (
    <section
      className="border-y border-line/70 bg-[#F4F6F8] py-5 md:py-6"
      aria-label="Trusted by growing companies"
    >
      <Container>
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:gap-8">
          <p className="shrink-0 font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-slate md:text-[11px]">
            Trusted by growing companies
          </p>
          <ul className="flex w-full flex-wrap items-center gap-x-0 gap-y-2 md:flex-1 md:justify-between">
            {COMPANIES.map((name, i) => (
              <li key={name} className="flex items-center">
                {i > 0 ? (
                  <span
                    aria-hidden
                    className="mx-3 hidden h-4 w-px bg-line sm:mx-4 sm:block md:mx-3 lg:mx-5"
                  />
                ) : null}
                <span className="font-display text-sm font-semibold tracking-tight text-slate/70 sm:text-[15px]">
                  {name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
