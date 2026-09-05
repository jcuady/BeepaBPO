import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";

export const metadata: Metadata = {
  title: "About",
  description:
    "Beepa began in 2019 with a purpose that grew into a people-first outsourcing partner.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <section className="bg-white py-20 md:py-28">
      <Container className="max-w-3xl">
        <SectionHeading as="h1">Built on Purpose. Growing Together.</SectionHeading>
        <p className="mt-6 text-base leading-relaxed text-slate">
          Beepa is a people-first outsourcing partner founded in 2019. A full
          About experience with founder story, timeline, and leadership is
          coming next. Until then, we would rather leave this honest than fill
          it with unfinished content.
        </p>
        <Button className="mt-8" nativeButton={false} render={<Link href="/contact" />}>
          Build Your Team
        </Button>
      </Container>
    </section>
  );
}
