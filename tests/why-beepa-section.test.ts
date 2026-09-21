import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("homepage why-beepa section", () => {
  it("keeps the local agent photo", () => {
    const webp = join(
      process.cwd(),
      "public/images/sections/why-beepa-agent.webp",
    );
    expect(existsSync(webp)).toBe(true);
  });

  it("matches hero split language and conversion CTAs", () => {
    const source = readFileSync(
      join(process.cwd(), "components/marketing/why-beepa-section.tsx"),
      "utf8",
    );
    expect(source).toContain("why-beepa-agent.webp");
    expect(source).toContain("lg:col-span-5");
    expect(source).toContain("lg:col-span-6");
    expect(source).toContain("lg:col-start-7");
    expect(source).toContain("why_beepa_primary_cta");
    expect(source).toContain("why_beepa_contact");
    expect(source).toContain("We find the people.");
    expect(source).toContain("Request a team");
    expect(source).toContain('href="/why-beepa"');
    expect(source).toContain('href="/contact"');
    expect(source).toContain('data-why-media="sec1"');
    expect(source).not.toContain("lg:col-start-5");
    expect(source).not.toContain("lg:row-start-1");
    expect(source).not.toContain("lg:whitespace-nowrap");
    expect(source).not.toContain("hero-photo-mask");
    expect(source).not.toContain("bg-navy");
    expect(source).not.toContain("Discover the Beepa Difference");
    expect(source).not.toContain("People-First");
  });
});
