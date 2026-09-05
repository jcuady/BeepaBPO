import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Customer support, back office, virtual assistants, sales support, and specialized outsourcing.",
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return (
    <section className="bg-white py-20 md:py-28">
      <Container className="max-w-3xl">
        <SectionHeading as="h1">
          Outsourcing solutions for a stronger tomorrow.
        </SectionHeading>
        <p className="mt-6 text-base leading-relaxed text-slate">
          Dedicated service pages are next. For now, start with a conversation
          about the roles and outcomes your business needs.
        </p>
        <Button className="mt-8" nativeButton={false} render={<Link href="/contact" />}>
          Build Your Team
        </Button>
      </Container>
    </section>
  );
}
