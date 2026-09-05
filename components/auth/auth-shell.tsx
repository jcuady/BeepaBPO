import Image from "next/image";
import Link from "next/link";
import { LimeArc } from "@/components/beepa/connected-growth-decoration";
import { SITE } from "@/lib/site";

export function AuthShell({
  title,
  description,
  children,
  footerLink,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footerLink?: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-mist">
      <div className="grid min-h-[100dvh] lg:grid-cols-2">
        <aside className="relative hidden overflow-hidden bg-navy p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <LimeArc className="absolute -right-16 -bottom-10 size-72" />
          <Link href="/" className="relative z-10 inline-flex min-h-11 w-fit items-center">
            <Image
              src="/brand/beepa-logo-horizontal.png"
              alt="BEEPA"
              width={160}
              height={50}
              className="h-10 w-auto brightness-0 invert"
            />
          </Link>
          <div className="relative z-10 max-w-md space-y-4">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
              {SITE.tagline}
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight text-white">
              {title}
            </h1>
            <p className="text-base leading-relaxed text-white/75">
              {description}
            </p>
          </div>
          <p className="relative z-10 text-sm text-white/50">
            Professional enough to trust. Human enough to connect with.
          </p>
        </aside>

        <div className="flex flex-col justify-center px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-10">
          <div className="mx-auto w-full max-w-md">
            <Link href="/" className="mb-6 inline-flex min-h-11 items-center lg:hidden">
              <Image
                src="/brand/beepa-logo-horizontal.png"
                alt="BEEPA"
                width={140}
                height={44}
                className="h-8 w-auto sm:h-9"
                priority
              />
            </Link>
            <div className="mb-5 lg:hidden">
              <h1 className="font-display text-2xl font-bold leading-tight text-navy">
                {title}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                {description}
              </p>
            </div>
            {children}
            {footerLink ? <div className="mt-6">{footerLink}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
