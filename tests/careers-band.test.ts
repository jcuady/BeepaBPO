import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("homepage careers band", () => {
  it("keeps the local team photo", () => {
    const webp = join(
      process.cwd(),
      "public/images/sections/careers-team.webp",
    );
    expect(existsSync(webp)).toBe(true);
  });

  it("matches hero overlap language and conversion CTAs", () => {
    const source = readFileSync(
      join(process.cwd(), "components/marketing/careers-band.tsx"),
      "utf8",
    );
    expect(source).toContain("careers-team.webp");
    expect(source).toContain("lg:col-span-7");
    expect(source).toContain('id="careers"');
    expect(source).toContain("careers_viewed");
    expect(source).toContain('href="/careers"');
    expect(source).toContain('href="/contact"');
    expect(source).toContain("People we hire");
    expect(source).toContain("people you get.");
    expect(source).toContain("See open roles");
    expect(source).toContain("Request a team");
    expect(source).toContain('data-careers-media="team"');
    expect(source).not.toContain("hero-photo-mask");
    expect(source).not.toContain("Explore Careers");
    expect(source).not.toContain("Now hiring");
    expect(source).not.toContain("SectionEyebrow");
    expect(source).not.toContain("animate-ping");
  });
});
