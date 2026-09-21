import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("homepage FAQ section", () => {
  it("keeps CMS items, FAQPage-ready markup, and hero CTA language", () => {
    const source = readFileSync(
      join(process.cwd(), "components/marketing/faq-section.tsx"),
      "utf8",
    );
    expect(source).toContain("export const FAQ_ITEMS");
    expect(source).toContain('id="faq"');
    expect(source).toContain("faq_primary_cta");
    expect(source).toContain('href="/contact"');
    expect(source).toContain("Request a team");
    expect(source).toContain('href="/services"');
    expect(source).toContain("<dl");
    expect(source).toContain("Questions teams ask");
    expect(source).toContain("items.length === 0");
    expect(source).toContain("lg:col-span-7");
    expect(source).toContain("lg:col-start-8");
    expect(source).toContain("lg:grid-cols-12");
    expect(source).toContain("lg:col-span-5");
    expect(source).toContain("lg:col-start-7");
    expect(source).not.toContain("max-w-3xl");
    expect(source).not.toContain("lg:whitespace-nowrap");
    expect(source).not.toContain("Accordion");
    expect(source).not.toContain("SectionEyebrow");
    expect(source).not.toContain("Still have questions");
  });
});
