import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("marketing site footer", () => {
  it("matches hero conversion language and keeps legal plus service anchors", () => {
    const source = readFileSync(
      join(process.cwd(), "components/layout/site-footer.tsx"),
      "utf8",
    );
    expect(source).toContain("data-site-footer");
    expect(source).toContain('data-analytics="footer_cta"');
    expect(source).toContain("Request a team");
    expect(source).toContain('href="/contact"');
    expect(source).toContain('href: "/privacy"');
    expect(source).toContain('href: "/terms"');
    expect(source).toContain("/services#customer-support");
    expect(source).toContain("/services#it-support");
    expect(source).toContain("/services#marketing");
    expect(source).toContain("/services#customer-relations");
    expect(source).toContain("/services#virtual-assistants");
    expect(source).toContain("Search. Place.");
    expect(source).toContain("People power better business");
    expect(source).not.toContain("Let's Talk");
    expect(source).not.toContain("Let&apos;s Talk");
    expect(source).not.toContain("sm:grid-cols-3");
  });
});
