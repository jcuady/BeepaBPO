import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("marketing site header", () => {
  it("marks the current page and uses the hero contact CTA", () => {
    const source = readFileSync(
      join(process.cwd(), "components/layout/site-header.tsx"),
      "utf8",
    );
    expect(source).toContain("data-site-header");
    expect(source).toContain('data-analytics="header_cta"');
    expect(source).toContain("usePathname");
    expect(source).toContain('aria-current={active ? "page" : undefined}');
    expect(source).toContain("{BRAND.cta}");
    expect(source).toContain("min-h-11");
    expect(source).not.toContain("transition-all");
    expect(source).not.toContain("nativeButton");
  });
});
