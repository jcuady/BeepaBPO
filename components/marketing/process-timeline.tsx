"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  IconArrowRight,
  IconClipboardList,
  IconHeartHandshake,
  IconMessages,
  IconSearch,
  IconSparkles,
  IconUserCheck,
  IconUsers,
} from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { SectionEyebrow } from "@/components/beepa/section-eyebrow";
import { SectionHeading } from "@/components/beepa/section-heading";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Discovery",
    body: "We learn how your business works and what success looks like.",
    icon: IconSearch,
  },
  {
    title: "Requirements",
    body: "Roles, skills, schedules, and tools are defined with clarity.",
    icon: IconClipboardList,
  },
  {
    title: "Talent sourcing",
    body: "Beepa identifies professionals who fit the brief.",
    icon: IconUsers,
  },
  {
    title: "Interview",
    body: "You meet shortlisted candidates before any placement.",
    icon: IconMessages,
  },
  {
    title: "Hiring",
    body: "We finalize selection and prepare the working relationship.",
    icon: IconUserCheck,
  },
  {
    title: "Onboarding",
    body: "Your team starts with structured support from day one.",
    icon: IconSparkles,
  },
  {
    title: "Ongoing support",
    body: "Beepa stays involved as your team and needs evolve.",
    icon: IconHeartHandshake,
  },
] as const;

export function ProcessTimeline() {
  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const mm = gsap.matchMedia();

    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const section = sectionRef.current;
      const viewport = viewportRef.current;
      const track = trackRef.current;
      if (!section || !viewport || !track) return;

      // Switch the static wrapped layout into a live horizontal track.
      viewport.classList.add("overflow-hidden");
      track.classList.add("w-max");

      const distance = () =>
        Math.max(0, track.scrollWidth - viewport.clientWidth);

      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const index = Math.round(self.progress * (STEPS.length - 1));
            setActiveStep((prev) => (prev === index ? prev : index));
          },
        },
      });

      ScrollTrigger.refresh();

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        viewport.classList.remove("overflow-hidden");
        track.classList.remove("w-max");
        gsap.set(track, { clearProps: "x" });
      };
    });

    return () => mm.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="overflow-x-hidden border-y border-line/70 bg-mist py-24 md:flex md:min-h-[100dvh] md:flex-col md:justify-center md:py-0"
    >
      <Container className="w-full">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <SectionEyebrow>How it works</SectionEyebrow>
            <SectionHeading className="mt-3 max-w-xl">
              A clear path from first call to a working team.
            </SectionHeading>
          </div>

          {/* Progress readout — desktop pinned mode */}
          <div className="hidden items-center gap-4 md:flex" aria-hidden>
            <span className="font-display text-sm font-semibold tabular-nums text-navy">
              {String(activeStep + 1).padStart(2, "0")}
              <span className="text-slate"> / {String(STEPS.length).padStart(2, "0")}</span>
            </span>
            <span className="relative h-1 w-40 overflow-hidden rounded-full bg-line">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-green-strong transition-[width] duration-200 ease-out"
                style={{
                  width: `${((activeStep + 1) / STEPS.length) * 100}%`,
                }}
              />
            </span>
          </div>
        </div>

        <div ref={viewportRef} className="mt-12 md:mt-14">
          <div
            ref={trackRef}
            className="flex flex-col gap-4 md:flex-row md:flex-nowrap md:gap-5"
          >
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === activeStep;
              return (
                <article
                  key={step.title}
                  className={cn(
                    "relative flex min-h-[220px] flex-col overflow-hidden rounded-[24px] bg-white p-7 ring-1 ring-line transition-[box-shadow,ring-color] duration-300 md:min-h-[320px] md:w-[min(78vw,400px)] md:shrink-0",
                    isActive &&
                      "shadow-[0_24px_48px_-32px_rgb(31_32_88/0.35)] ring-green-strong/40",
                  )}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-2 -top-6 select-none font-display text-[6rem] font-extrabold leading-none tracking-tighter text-navy/[0.05]"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span
                    className={cn(
                      "flex size-12 items-center justify-center rounded-[14px] ring-1 transition-colors duration-300",
                      isActive
                        ? "bg-green-strong text-white ring-green-strong"
                        : "bg-soft-green text-green-strong ring-green-strong/10",
                    )}
                  >
                    <Icon stroke={1.5} className="size-6" aria-hidden />
                  </span>

                  <h3 className="mt-6 font-display text-xl font-bold tracking-tight text-navy">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-[40ch] flex-1 text-sm leading-relaxed text-slate">
                    {step.body}
                  </p>

                  <span
                    className={cn(
                      "mt-6 h-1 w-10 rounded-full transition-colors duration-300",
                      isActive ? "bg-lime" : "bg-line",
                    )}
                  />
                </article>
              );
            })}

            {/* Terminal CTA card */}
            <Link
              href="/contact"
              className="group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[24px] bg-navy p-7 transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1 md:min-h-[320px] md:w-[min(78vw,400px)] md:shrink-0"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-lime/20 blur-3xl"
              />
              <h3 className="relative font-display text-xl font-bold tracking-tight text-white text-balance">
                Ready when you are.
              </h3>
              <span className="relative mt-6 inline-flex items-center gap-2 font-display text-sm font-semibold text-lime">
                Start with a discovery call
                <span className="flex size-8 items-center justify-center rounded-full bg-lime text-navy transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-1">
                  <IconArrowRight stroke={2} className="size-3.5" aria-hidden />
                </span>
              </span>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
