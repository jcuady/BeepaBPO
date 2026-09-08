import { Container } from "@/components/beepa/container";

/** Honest trust strip — no fabricated client logos. */
export function TrustedBySection() {
  return (
    <section className="border-y border-line bg-white py-10 md:py-12">
      <Container>
        <p className="text-center font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">
          Built for Philippine BPO operations
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-slate md:text-base">
          Beepa helps growing teams run attendance, payroll approvals, client
          portals, and support tickets in one place — with clear roles and audit
          trails.
        </p>
      </Container>
    </section>
  );
}
