import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";

export const metadata: Metadata = {
  title: "Resources",
  description: "Practical insights for teams building with Beepa.",
  alternates: { canonical: "/resources" },
};

export default function ResourcesPage() {
  return (
    <section className="bg-white py-20 md:py-28">
      <Container className="max-w-3xl">
        <SectionHeading as="h1">Resources</SectionHeading>
        <p className="mt-6 text-base leading-relaxed text-slate">
          Guides and updates will publish here when they are ready. We will not
          invent placeholder articles.
        </p>
        <Button className="mt-8" nativeButton={false} render={<Link href="/contact" />}>
          Build Your Team
        </Button>
      </Container>
    </section>
  );
}
