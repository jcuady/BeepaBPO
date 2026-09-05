import Image from "next/image";
import { Container } from "@/components/beepa/container";

// Real brand logos as placeholders (Simple Icons CDN). ponytail: swap to client logos before launch.
const LOGOS = [
  { slug: "google", alt: "Google" },
  { slug: "microsoft", alt: "Microsoft" },
  { slug: "amazon", alt: "Amazon" },
  { slug: "apple", alt: "Apple" },
  { slug: "meta", alt: "Meta" },
  { slug: "netflix", alt: "Netflix" },
  { slug: "spotify", alt: "Spotify" },
  { slug: "airbnb", alt: "Airbnb" },
] as const;

export function TrustedBySection() {
  return (
    <section className="border-y border-line bg-white py-10 md:py-12">
      <Container>
        <p className="text-center font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">
          Trusted by growing companies
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12 lg:gap-x-16">
          {LOGOS.map((logo) => (
            <li key={logo.slug} className="flex items-center">
              <Image
                src={`https://cdn.simpleicons.org/${logo.slug}/1f2058`}
                alt={logo.alt}
                width={120}
                height={32}
                className="h-7 w-auto opacity-60 transition-opacity hover:opacity-100 sm:h-8"
                unoptimized
              />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
