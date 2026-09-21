"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconArrowRight, IconMenu2 } from "@tabler/icons-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Container } from "@/components/beepa/container";
import { BRAND, NAV_LINKS } from "@/lib/site";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-strong/45 focus-visible:ring-offset-2";

function isActivePath(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function HeaderCta({ className }: { className?: string }) {
  return (
    <Link
      href="/contact"
      data-analytics="header_cta"
      className={cn(
        "group inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-green px-5 font-display text-sm font-semibold whitespace-nowrap text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-green-strong",
        focusRing,
        className,
      )}
    >
      {BRAND.cta}
      <span className="flex size-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5">
        <IconArrowRight stroke={1.75} className="size-3" aria-hidden="true" />
      </span>
    </Link>
  );
}

function NavLink({
  href,
  label,
  pathname,
  className,
}: {
  href: string;
  label: string;
  pathname: string;
  className?: string;
}) {
  const active = isActivePath(href, pathname);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex min-h-11 items-center font-display text-sm font-medium text-navy transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] after:pointer-events-none after:absolute after:inset-x-2 after:bottom-2 after:h-px after:bg-green-strong after:opacity-0",
        active
          ? "text-green-strong after:opacity-100"
          : "[@media(hover:hover)_and_(pointer:fine)]:hover:text-green-strong",
        focusRing,
        className,
      )}
    >
      {label}
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname() ?? "/";

  return (
    <header
      data-site-header
      className="site-header sticky top-0 z-40 h-14 pt-[env(safe-area-inset-top)] sm:h-[72px]"
    >
      <Container className="flex h-14 items-center justify-between gap-2 sm:h-[72px] sm:gap-4">
        <Link
          href="/"
          className={cn(
            "relative flex h-11 min-h-11 min-w-0 shrink items-center rounded-[4px]",
            focusRing,
          )}
          aria-label={`${BRAND.displayName} home`}
        >
          <Image
            src={BRAND.logoUrl}
            alt=""
            width={160}
            height={50}
            className="h-8 w-auto max-w-[132px] object-contain object-left sm:h-9 sm:max-w-none"
            priority
          />
        </Link>

        <nav
          className="hidden items-center gap-5 lg:flex xl:gap-6"
          aria-label="Primary"
        >
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              pathname={pathname}
              className="whitespace-nowrap px-2"
            />
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/login"
            className={cn(
              "inline-flex min-h-11 items-center px-1 font-display text-sm font-semibold text-navy transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-green-strong",
              focusRing,
            )}
          >
            Sign In
          </Link>
          <HeaderCta />
        </div>

        <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
          <HeaderCta className="px-4" />
          <Sheet>
            <SheetTrigger
              render={
                <button
                  type="button"
                  aria-label="Open menu"
                  className={cn(
                    "inline-flex size-11 items-center justify-center rounded-full text-navy transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist",
                    focusRing,
                  )}
                />
              }
            >
              <IconMenu2 stroke={1.75} aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="right" className="bg-white">
              <SheetHeader>
                <SheetTitle className="font-display text-navy">Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4" aria-label="Mobile">
                {NAV_LINKS.map((link) => {
                  const active = isActivePath(link.href, pathname);
                  return (
                    <SheetClose
                      key={link.href}
                      render={
                        <Link
                          href={link.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex min-h-11 items-center rounded-[8px] px-2 font-display text-base font-medium transition-[color,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                            active
                              ? "bg-soft-green text-green-strong"
                              : "text-navy [@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist",
                            focusRing,
                          )}
                        />
                      }
                    >
                      {link.label}
                    </SheetClose>
                  );
                })}
                <SheetClose
                  render={
                    <Link
                      href="/login"
                      className={cn(
                        "flex min-h-11 items-center rounded-[8px] px-2 font-display text-base font-medium text-navy [@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist",
                        focusRing,
                      )}
                    />
                  }
                >
                  Sign In
                </SheetClose>
                <SheetClose
                  render={
                    <Link
                      href="/employee/login"
                      className={cn(
                        "flex min-h-11 items-center rounded-[8px] px-2 font-display text-base font-medium text-navy [@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist",
                        focusRing,
                      )}
                    />
                  }
                >
                  Employee Portal
                </SheetClose>
              </nav>
              <div className="mt-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <SheetClose
                  render={
                    <Link
                      href="/contact"
                      data-analytics="header_cta"
                      className={cn(
                        "inline-flex min-h-11 w-full items-center justify-center rounded-full bg-green px-6 font-display text-sm font-semibold text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-green-strong",
                        focusRing,
                      )}
                    />
                  }
                >
                  {BRAND.cta}
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </Container>
    </header>
  );
}
