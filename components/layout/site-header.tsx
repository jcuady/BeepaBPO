"use client";

import Image from "next/image";
import Link from "next/link";
import { IconArrowRight, IconMenu2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Container } from "@/components/beepa/container";
import { NAV_LINKS } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="site-header sticky top-0 z-40 h-14 pt-[env(safe-area-inset-top)] sm:h-[72px]">
      <Container className="flex h-14 items-center justify-between gap-2 sm:h-[72px] sm:gap-4">
        <Link
          href="/"
          className="relative flex h-11 min-h-11 min-w-0 shrink items-center focus-visible:ring-2 focus-visible:ring-green-strong focus-visible:ring-offset-2"
          aria-label="BEEPA home"
        >
          <Image
            src="/brand/beepa-logo-horizontal.png"
            alt="BEEPA Business Process Outsourcing"
            width={160}
            height={50}
            className="h-8 w-auto max-w-[132px] object-contain object-left sm:h-9 sm:max-w-none"
            priority
          />
        </Link>

        <nav
          className="hidden items-center gap-6 lg:flex xl:gap-7"
          aria-label="Primary"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap px-2 font-display text-sm font-medium text-navy transition-colors hover:text-green-strong"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center font-display text-sm font-semibold text-navy transition-colors hover:text-green-strong"
          >
            Sign In
          </Link>
          <Button
            className="group gap-2"
            nativeButton={false}
            render={<Link href="/contact" />}
          >
            Let&apos;s Talk
            <span className="flex size-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
              <IconArrowRight stroke={2} className="size-3" />
            </span>
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
          <Button
            size="sm"
            className="min-h-11 max-w-[9.5rem] truncate px-3 text-xs sm:max-w-none sm:px-4 sm:text-sm"
            nativeButton={false}
            render={<Link href="/contact" />}
          >
            Let&apos;s Talk
          </Button>
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Open menu" />
              }
            >
              <IconMenu2 stroke={2} />
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4" aria-label="Mobile">
                {NAV_LINKS.map((link) => (
                  <SheetClose
                    key={link.href}
                    render={
                      <Link
                        href={link.href}
                        className="flex min-h-11 items-center rounded-[8px] px-2 font-display text-base font-medium text-navy hover:bg-mist"
                      />
                    }
                  >
                    {link.label}
                  </SheetClose>
                ))}
                <SheetClose
                  render={
                    <Link
                      href="/login"
                      className="flex min-h-11 items-center rounded-[8px] px-2 font-display text-base font-medium text-navy hover:bg-mist"
                    />
                  }
                >
                  Sign In
                </SheetClose>
                <SheetClose
                  render={
                    <Link
                      href="/employee/login"
                      className="flex min-h-11 items-center rounded-[8px] px-2 font-display text-base font-medium text-navy hover:bg-mist"
                    />
                  }
                >
                  Employee Portal
                </SheetClose>
              </nav>
              <div className="mt-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <SheetClose
                  render={
                    <Button
                      className="w-full"
                      nativeButton={false}
                      render={<Link href="/contact" />}
                    />
                  }
                >
                  Let&apos;s Talk
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </Container>
    </header>
  );
}
