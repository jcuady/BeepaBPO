import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("landing page has no entrance fade", () => {
  it("does not hide hero or reveal nodes before paint", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const reveal = readFileSync(
      join(process.cwd(), "components/marketing/reveal.tsx"),
      "utf8",
    );
    const hero = readFileSync(
      join(process.cwd(), "components/marketing/hero-section.tsx"),
      "utf8",
    );

    expect(css).not.toContain("[data-hero] {");
    expect(css).not.toContain(".reveal {");
    expect(css).not.toContain("translateY(28px)");
    expect(reveal).not.toContain("IntersectionObserver");
    expect(reveal).not.toContain("is-visible");
    expect(hero).not.toContain("gsap");
    expect(hero).not.toContain("useEffect");
    expect(hero).not.toContain("hero-photo-mask");
    expect(hero).toContain("hero_primary_cta");
    expect(hero).toContain("People power");
  });
});
