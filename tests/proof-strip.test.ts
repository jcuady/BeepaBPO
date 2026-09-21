import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("homepage proof strip", () => {
  it("matches hero CTA language without stealing the manpower deep link", () => {
    const source = readFileSync(
      join(process.cwd(), "components/marketing/proof-strip.tsx"),
      "utf8",
    );
    expect(source).toContain('id="people-process-progress"');
    expect(source).toContain("data-proof-strip");
    expect(source).toContain("proof_primary_cta");
    expect(source).toContain('href="/contact"');
    expect(source).toContain("Request a team");
    expect(source).toContain("/case-studies");
    expect(source).toContain("People. Process.");
    expect(source).toContain("lg:col-span-7");
    expect(source).toContain("lg:col-start-8");
    expect(source).toContain("lg:grid-cols-12");
    expect(source).not.toContain("max-w-3xl");
    expect(source).not.toContain("lg:whitespace-nowrap");
    expect(source).not.toContain("lg:col-span-4");
    expect(source).not.toContain("lg:col-span-3");
    expect(source).not.toContain("border-l-[3px]");
    expect(source).not.toContain('"01"');
    expect(source).not.toContain("Build your team");
    expect(source).not.toContain("How we work");
  });
});
