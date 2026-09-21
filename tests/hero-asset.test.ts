import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("homepage hero asset", () => {
  it("ships a 1600x900 source the optimizer can resample", () => {
    const png = join(process.cwd(), "public/images/hero/beepa-team-hero.png");
    expect(existsSync(png)).toBe(true);
    const bytes = readFileSync(png);
    expect(bytes.readUInt32BE(16)).toBe(1600);
    expect(bytes.readUInt32BE(20)).toBe(900);
  });

  it("loads the photo through next/image with priority", () => {
    const source = readFileSync(
      join(process.cwd(), "components/marketing/hero-section.tsx"),
      "utf8",
    );
    expect(source).toContain("beepa-team-hero.png");
    expect(source).toContain("priority");
    expect(source).toContain("quality={70}");
    expect(source).toContain("hero_primary_cta");
    expect(source).toContain("hero_secondary_cta");
    expect(source).toContain("Let&apos;s Talk");
    expect(source).toContain("Explore Our Services");
    expect(source).toContain("lg:col-span-5");
    expect(source).toContain("lg:col-span-6");
    expect(source).toContain("lg:col-start-7");
    expect(source).not.toContain("lg:col-start-5");
    expect(source).not.toContain("lg:row-start-1");
    expect(source).not.toContain("hero-photo-mask");
    expect(source).not.toContain('stroke="#93C63D"');
  });
});
