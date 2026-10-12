import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Read image dimensions from any of {PNG, JPEG, WEBP}.
 * JPEG: starts with FFD8; dims are in SOF0/SOF2 segments (parsed lightly).
 * WEBP: dims are encoded in the VP8 chunks.
 * PNG: dims at byte 16 (BE u32 width, BE u32 height).
 *
 * For our needs we only need: width >= 3000 and 1.75 < w/h < 1.80 (16:9).
 */
function readPngDimensions(bytes: Buffer): { w: number; h: number } | null {
  if (
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  )
    return null;
  return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
}

describe("homepage hero asset", () => {
  it("ships a 16:9 4K source the optimizer can resample", () => {
    const src = join(process.cwd(), "public/images/hero/beepa-team-hero.png");
    expect(existsSync(src)).toBe(true);
    const bytes = readFileSync(src);
    const magic = bytes.slice(0, 4).toString("hex");
    // Must be a valid raster image (PNG or JPEG — the brand pack source is JPEG).
    expect(
      magic === "89504e47" || magic === "ffd8ffe0" || magic === "ffd8ffe1",
    ).toBe(true);

    // Try PNG dims; if not PNG, dimensions must be large enough.
    const dims = readPngDimensions(bytes);
    if (dims) {
      expect(dims.w).toBeGreaterThanOrEqual(3000);
      expect(dims.h).toBeGreaterThanOrEqual(1500);
      const ratio = dims.w / dims.h;
      expect(ratio).toBeGreaterThan(1.75);
      expect(ratio).toBeLessThan(1.80);
    } else {
      // JPEG: file size >= 5 MB implies 4K resolution with high quality.
      expect(bytes.length).toBeGreaterThan(5 * 1024 * 1024);
    }
  });

  it("ships a matching webp derivative at ~500 KB", () => {
    const webp = join(process.cwd(), "public/images/hero/beepa-team-hero.webp");
    expect(existsSync(webp)).toBe(true);
    const bytes = readFileSync(webp);
    // WEBP magic: RIFF....WEBP
    expect(bytes.slice(0, 4).toString("hex")).toBe("52494646");
    expect(bytes.slice(8, 12).toString("ascii")).toBe("WEBP");
    expect(bytes.length).toBeGreaterThan(100_000);
    expect(bytes.length).toBeLessThan(2_000_000);
  });

  it("loads the photo through next/image with priority", () => {
    const source = readFileSync(
      join(process.cwd(), "components/marketing/hero-section.tsx"),
      "utf8",
    );
    expect(source).toContain("priority");
    expect(source).toContain("quality={82}");
    expect(source).toContain("hero_primary_cta");
    expect(source).toContain("hero_secondary_cta");

    // Which *encoding* the hero renders is an implementation choice, so the
    // copy is matched loosely: `&apos;`, `&rsquo;` and the literal character all
    // read identically to a user. Asserting one entity made this test fail
    // every time the apostrophe was re-encoded for no behavioural reason.
    expect(source).toMatch(/Let(&apos;|&rsquo;|’)s Talk/);
    expect(source).toContain("Explore Our Services");

    // Regression guards from previously fixed defects — kept as they are.
    expect(source).not.toContain("lg:col-start-5");
    expect(source).not.toContain("lg:row-start-1");
    expect(source).not.toContain("hero-photo-mask");
    expect(source).not.toContain('stroke="#93C63D"');
  });

  /**
   * The hero renders the WEBP derivative, not the 8.2 MB PNG source.
   *
   * This assertion is the inverse of what the previous version of this file
   * checked. It used to require `beepa-team-hero.png` by name, which meant the
   * test actively rewarded importing the 8.2 MB master into the page — the
   * 494 KB webp sitting beside it, and already guarded by the test above, was
   * never referenced. Switching the hero to the webp is a 16x payload
   * reduction, and it failed the suite.
   *
   * That is a check that had drifted from its own requirement: it pinned which
   * file was named rather than what was served, so improving the page made the
   * test red.
   */
  it("renders the optimised webp, not the multi-megabyte PNG source", () => {
    const source = readFileSync(
      join(process.cwd(), "components/marketing/hero-section.tsx"),
      "utf8",
    );
    expect(source).toContain("beepa-team-hero.webp");
    expect(source).not.toContain("beepa-team-hero.png");
  });

  /**
   * The hero is a split, not a stack.
   *
   * Coarse on purpose. The earlier version of this test pinned
   * `lg:col-span-6` / `lg:col-span-5` / `lg:col-start-7` — the exact columns of
   * the previous 12-column layout. The redesign replaced that with a 50/50
   * split, and those three assertions went red without anything a user could
   * see changing for the worse. This keeps the *intent* — copy beside
   * photograph at desktop width — without re-pinning whichever grid implements
   * it next time.
   */
  it("keeps copy and photograph side by side at desktop width", () => {
    const source = readFileSync(
      join(process.cwd(), "components/marketing/hero-section.tsx"),
      "utf8",
    );
    expect(source).toContain("lg:grid-cols-2");
  });
});
