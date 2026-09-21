import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("marketing final CTA", () => {
  it("matches hero conversion language without a navy island", () => {
    const source = readFileSync(
      join(process.cwd(), "components/marketing/final-cta.tsx"),
      "utf8",
    );
    expect(source).toContain('id="get-started"');
    expect(source).toContain("data-final-cta");
    expect(source).toContain('data-analytics="final_cta"');
    expect(source).toContain('href="/contact"');
    expect(source).toContain("Request a team");
    expect(source).toContain("Tell us the role.");
    expect(source).toContain("We staff it.");
    expect(source).toContain('href="/why-beepa"');
    expect(source).toContain("lg:col-span-7");
    expect(source).toContain("lg:col-start-8");
    expect(source).toContain("lg:grid-cols-12");
    expect(source).not.toContain("max-w-3xl");
    expect(source).not.toContain("lg:whitespace-nowrap");
    expect(source).not.toContain("bg-navy");
    expect(source).not.toContain("Let's Talk");
    expect(source).not.toContain("Let&apos;s Talk");
    expect(source).not.toContain("text-center");
    expect(source).not.toContain("LimeArc");
  });
});
