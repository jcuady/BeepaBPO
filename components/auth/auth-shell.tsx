import Image from "next/image";
import Link from "next/link";
import {
  IconBrandLinkedin,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandYoutube,
} from "@tabler/icons-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SITE } from "@/lib/site";

const SOCIALS = [
  { href: "https://linkedin.com", label: "LinkedIn", icon: IconBrandLinkedin },
  { href: "https://facebook.com", label: "Facebook", icon: IconBrandFacebook },
  { href: "https://instagram.com", label: "Instagram", icon: IconBrandInstagram },
  { href: "https://youtube.com", label: "YouTube", icon: IconBrandYoutube },
] as const;

export function AuthShell({
  eyebrow,
  title,
  description,
  features,
  imageSrc,
  imageAlt,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  features: { label: string; icon: React.ElementType; description?: string }[];
  imageSrc: string;
  imageAlt: string;
  children: React.ReactNode;
}) {
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-mist">
      <SiteHeader />

      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto grid max-w-[1280px] gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Left Column */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-[24px] bg-white p-8 shadow-sm sm:p-10 lg:col-span-7 xl:p-12">
            {/* Decorative background elements can go here if needed */}
            <div className="absolute -left-24 bottom-0 h-96 w-96 rounded-full border-[40px] border-soft-green opacity-50" />
            
            <div className="relative z-10 max-w-xl">
              <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-green-strong">
                {eyebrow}
              </p>
              <h1 className="mt-4 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.05] tracking-tight text-navy">
                {title}
              </h1>
              <p className="mt-4 text-base leading-relaxed text-slate sm:text-lg">
                {description}
              </p>

              <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <li key={feature.label} className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft-green text-green-strong">
                        <Icon stroke={2} className="size-5" />
                      </div>
                      <div className="pt-2">
                        <p className="font-display text-sm font-bold text-navy">
                          {feature.label}
                        </p>
                        {feature.description && (
                          <p className="mt-0.5 text-xs text-slate">
                            {feature.description}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="relative z-10 mt-12 aspect-[4/3] w-full overflow-hidden rounded-[16px] sm:aspect-[16/9] lg:absolute lg:-bottom-8 lg:-right-8 lg:mt-0 lg:h-[85%] lg:w-[55%] lg:rounded-tl-[24px]">
              <Image
                src={imageSrc}
                alt={imageAlt}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
                priority
              />
            </div>
          </div>

          {/* Right Column - Form */}
          <div className="flex items-center justify-center lg:col-span-5">
            <div className="w-full max-w-md">
              <div className="mb-8 text-center">
                <Link href="/" className="inline-flex min-h-11 items-center justify-center">
                  <Image
                    src="/brand/beepa-logo-horizontal.png"
                    alt="BEEPA"
                    width={160}
                    height={50}
                    className="h-10 w-auto"
                    priority
                  />
                </Link>
              </div>
              {children}
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-line bg-white py-6">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-sm text-slate">
            &copy; {year} {SITE.legalName}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate">
            <Link href="/privacy" className="hover:text-green-strong">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-green-strong">Terms of Service</Link>
            <Link href="/contact" className="hover:text-green-strong">Contact Us</Link>
            <div className="flex items-center gap-3 pl-2">
              {SOCIALS.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="text-navy hover:text-green-strong"
                  >
                    <Icon stroke={1.5} className="size-5" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
