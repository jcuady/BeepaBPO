import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("homepage services section", () => {
  it("ships a 4:5 support-floor photo", () => {
    const png = join(
      process.cwd(),
      "public/images/services/customer-support-floor.png",
    );
    expect(existsSync(png)).toBe(true);
    const bytes = readFileSync(png);
    expect(bytes.readUInt32BE(16)).toBe(900);
    expect(bytes.readUInt32BE(20)).toBe(1125);
  });

  it("matches hero split language and conversion CTAs", () => {
    const source = readFileSync(
      join(process.cwd(), "components/marketing/services-section.tsx"),
      "utf8",
    );
    expect(source).toContain("customer-support-floor.png");
    expect(source).toContain("lg:col-span-5");
    expect(source).toContain("lg:col-span-6");
    expect(source).toContain("lg:col-start-7");
    expect(source).toContain("services_featured_cta");
    expect(source).toContain("BPO teams that");
    expect(source).toContain('href="/contact"');
    expect(source).toContain("Request a team");
    expect(source).toContain("SERVICES_CATALOG");
    expect(source).toContain("`/services#${item.slug}`");
    expect(source).not.toContain("lg:col-start-5");
    expect(source).not.toContain("lg:row-start-1");
    expect(source).not.toContain("hero-photo-mask");
    expect(source).not.toContain("Asset required");
  });

  it("publishes an ItemList for the principal roles", () => {
    const page = readFileSync(
      join(process.cwd(), "app/(marketing)/page.tsx"),
      "utf8",
    );
    const jsonLd = readFileSync(
      join(process.cwd(), "lib/seo/json-ld.tsx"),
      "utf8",
    );
    const catalog = readFileSync(
      join(process.cwd(), "lib/marketing/services-catalog.ts"),
      "utf8",
    );
    expect(page).toContain("servicesItemListJsonLd");
    expect(jsonLd).toContain("ItemList");
    expect(jsonLd).toContain("SERVICES_CATALOG");
    expect(catalog).toContain('slug: "it-support"');
    expect(catalog).toContain('slug: "marketing"');
    expect(catalog).toContain('slug: "elearning-course-dev"');
    expect(catalog).toContain('slug: "slide-creator"');
    expect(catalog).toContain('slug: "data-entry"');
    expect(catalog).toContain('slug: "customer-relations"');
  });

  it("uses a 2-col role rail instead of equal card columns", () => {
    const source = readFileSync(
      join(process.cwd(), "components/marketing/services-section.tsx"),
      "utf8",
    );
    expect(source).toContain("SERVICES_CATALOG");
    expect(source).toContain("md:grid-cols-2");
    expect(source).not.toContain("lg:grid-cols-4");
    expect(source).toContain('"it-support"');
    expect(source).toContain('"customer-relations"');
  });
});
