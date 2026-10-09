import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("homepage services section", () => {
  it("ships a 4:3 services-section photo + matching webp", () => {
    const png = join(
      process.cwd(),
      "public/images/services/customer-support-floor.png",
    );
    const webp = png.replace(/\.png$/, ".webp");
    expect(existsSync(png)).toBe(true);
    expect(existsSync(webp)).toBe(true);
    const bytes = readFileSync(png);
    // The brand-pack source is JPEG — accept PNG or JPEG magic.
    const magic = bytes.slice(0, 4).toString("hex");
    expect(
      magic === "89504e47" || magic === "ffd8ffe0" || magic === "ffd8ffe1",
    ).toBe(true);
    // File must be at least 5 MB (4K source) and webp ~500 KB.
    expect(bytes.length).toBeGreaterThan(5 * 1024 * 1024);
    const wb = readFileSync(webp);
    expect(wb.slice(8, 12).toString("ascii")).toBe("WEBP");
    expect(wb.length).toBeGreaterThan(100_000);
    expect(wb.length).toBeLessThan(2_000_000);
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
