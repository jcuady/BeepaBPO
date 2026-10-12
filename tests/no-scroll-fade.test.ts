import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The landing page was replaced wholesale by the "BeepaBPO new landing design"
 * reference, so this guard now reads the new page rather than the hero section
 * it used to cover.
 *
 * The intent is unchanged and is worth keeping: the page must paint its hero
 * immediately. An entrance animation that starts at `opacity: 0` and is driven
 * by an observer makes the LCP element invisible until JS runs, which is a
 * real regression that no type check notices.
 */
describe("landing page has no entrance fade", () => {
  it("does not hide hero or reveal nodes before paint", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const landing = readFileSync(
      join(process.cwd(), "components/landing/landing-page.tsx"),
      "utf8",
    );
    const landingCss = readFileSync(
      join(process.cwd(), "components/landing/landing.css"),
      "utf8",
    );

    expect(css).not.toContain("[data-hero] {");
    expect(css).not.toContain(".reveal {");
    expect(css).not.toContain("translateY(28px)");

    expect(landing).not.toContain("IntersectionObserver");
    expect(landing).not.toContain("gsap");
    expect(landing).not.toContain("useEffect");

    // No keyframes and no hidden start state anywhere in the page's CSS.
    // (`animation: none` in the reduced-motion block is a reset, not an
    // entrance animation, so the check is on @keyframes rather than the bare
    // property name — a property-name match flags its own reset.)
    expect(landingCss).not.toContain("@keyframes");
    expect(landingCss).not.toContain("opacity:0");
    expect(landingCss).not.toContain("translateY");

    // The hero headline is server-rendered, not client-conditional.
    expect(landing).toContain("Your people.");
  });
});