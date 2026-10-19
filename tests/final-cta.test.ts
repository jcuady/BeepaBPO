import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FinalCTA } from "@/components/marketing/final-cta";

/**
 * These assertions used to read the component's source text, which made them
 * a hostage to *how* the markup was written: extracting the CTA into the shared
 * `MarketingCta` primitive moved `data-analytics="final_cta"` behind an
 * `analytics` prop and failed a test whose actual intent — that the CTA is a
 * tagged link to /contact — was still satisfied.
 *
 * The rendered markup is the real contract, so that is what is asserted here.
 * The two source reads that remain are deliberate: they guard authoring rules
 * that are about the file itself (no navy island, no centred column) rather
 * than about anything a browser would ever see.
 */
/**
 * The VISIBLE text of the rendered markup.
 *
 * Tags are replaced with NOTHING, not with a space, because that is what a
 * browser does: `<span>We staff it</span><span>.</span>` is the sentence
 * "We staff it.", and inserting a space would make it "We staff it .".
 *
 * This matters because the heading splits its two colours across two spans --
 * green for the clause, navy for the full stop. Asserting a contiguous
 * substring of the raw HTML therefore breaks on a change that does not change
 * a single thing a reader sees. The copy is the contract; the markup is not.
 */
const visibleText = (markup: string) =>
  markup
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

describe("marketing final CTA", () => {
  const html = renderToStaticMarkup(createElement(FinalCTA));
  const text = visibleText(html);

  it("keeps the conversion anchors as real, tagged links", () => {
    expect(html).toContain('href="/contact"');
    expect(html).toContain('data-analytics="final_cta"');
    expect(html).toContain('href="/why-beepa"');
  });

  it("keeps the conversion language", () => {
    expect(text).toContain("Request a team");
    expect(text).toContain("Tell us the role.");
    expect(text).toContain("We staff it.");
  });

  it("does not double the full stop", () => {
    // The green clause carried its own "." AND the navy full stop followed it,
    // so the band read "We staff it.." on every page that used it. The copy
    // assertions above pass either way -- "We staff it.." contains
    // "We staff it." -- which is exactly why it needed its own guard.
    expect(text).not.toContain("..");
  });

  it("keeps the landing anchor and its flag for external tooling", () => {
    expect(html).toContain('id="get-started"');
    expect(html).toContain("data-final-cta");
  });

  it("uses the square brand CTA on both actions", () => {
    // Both CTAs come from `MarketingCta`, so the primary carries the arrow chip
    // and the secondary does not. Count the chips rather than matching prose.
    expect(html.match(/bg-white\/15/g) ?? []).toHaveLength(1);
  });

  it("does not reintroduce the navy island or centred column", () => {
    const source = readFileSync(
      join(process.cwd(), "components/marketing/final-cta.tsx"),
      "utf8",
    );
    expect(source).not.toContain("max-w-3xl");
    expect(source).not.toContain("lg:whitespace-nowrap");
    expect(source).not.toContain("bg-navy");
    expect(source).not.toContain("Let's Talk");
    expect(source).not.toContain("Let&apos;s Talk");
    expect(source).not.toContain("text-center");
    expect(source).not.toContain("LimeArc");
  });
});