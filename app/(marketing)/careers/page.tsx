import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Build your career with people who value your growth.",
  alternates: { canonical: "/careers" },
};

export default function CareersPage() {
  return (
    <section className="bg-white py-20 md:py-28">
      <Container className="max-w-3xl">
        <SectionHeading as="h1">
          Build your career with people who value your growth.
        </SectionHeading>
        <p className="mt-6 text-base leading-relaxed text-slate">
          Open roles and applications will live here once Beepa Careers is
          connected to the hiring pipeline. Until then, reach out if you want to
          learn about joining the team.
        </p>
        <Button className="mt-8" nativeButton={false} render={<Link href="/contact" />}>
          Build Your Team
        </Button>
      </Container>
    </section>
  );
}
