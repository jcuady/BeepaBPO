import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("homepage manpower model", () => {
  it("keeps the how-we-work deep link and hero CTA language", () => {
    const source = readFileSync(
      join(process.cwd(), "components/marketing/manpower-model-section.tsx"),
      "utf8",
    );
    expect(source).toContain('id="how-we-work"');
    expect(source).toContain("data-manpower-model");
    expect(source).toContain("manpower_primary_cta");
    expect(source).toContain('href="/contact"');
    expect(source).toContain("Request a team");
    expect(source).toContain("Search. Place.");
    expect(source).toContain("salary");
    expect(source).toContain("talent");
    expect(source).toContain("<ol");
    expect(source).toContain("lg:col-span-7");
    expect(source).toContain("lg:col-start-8");
    expect(source).toContain("lg:grid-cols-12");
    expect(source).not.toContain("max-w-3xl");
    expect(source).not.toContain("lg:whitespace-nowrap");
    expect(source).not.toContain("border-l-[3px]");
    expect(source).not.toContain("pin-spacer");
    expect(source).not.toContain("ScrollTrigger");
    expect(source).not.toContain("bg-navy");
    expect(source).not.toContain("Request talent");
    expect(source).not.toContain(">01<");
    expect(source).not.toContain(">02<");
    expect(source).not.toContain("SectionEyebrow");
  });
});
