import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The census must resolve a form control's NAME the way an accessibility API
 * does, and must never substitute the control's VALUE.
 *
 * WHAT WENT WRONG
 * ---------------
 * `qa-control-surface-census.mjs` builds the number the completion matrix quotes
 * as action-control coverage. Its `nameOf` read, in order: `aria-label`,
 * `title`, `placeholder`, `name`, then `el.value` — and never once consulted
 * `<label for>`, a wrapping `<label>`, or `aria-labelledby`, which are the
 * sources that actually name most form controls.
 *
 * Two failures came out of that, and they point in opposite directions:
 *
 *  1. A `<select>` labelled "Pay frequency" was recorded under its SELECTED
 *     VALUE. The run listed `semi_monthly`, `25000`, `45000`, `won`, `lost`,
 *     `new`, `discovery`, `in_progress` among the controls with "no matching
 *     assertion" — all of them the *data*, not the control's name. `matchAssertion`
 *     then compared a data value against assertion names and could never match,
 *     so the gap it printed was substantially an artifact of its own extractor.
 *  2. A control with no label at all was reported as NAMED, because it had a
 *     value. So the one finding this census exists to make — a control with no
 *     accessible name — could never be made. The run printed "0 icon-only
 *     control(s) with no accessible name at all" partly because the fallback
 *     had already invented a name for them.
 *
 * The fallback is not a harmless last resort. **A form value is data the user
 * chose; it is never an accessible name.** Absorbing "I could not find a name"
 * into "here is the value" converts an unnamed control into a plausibly-named
 * one, and a census that cannot report the defect it was built to report has no
 * reason to exist.
 *
 * Assertions run on comments stripped: the explanation above and in the source
 * both name the removed `el.value`, so a raw text search would match the prose
 * that documents the fix.
 */
const FILE = join(process.cwd(), "scripts", "audit", "qa-control-surface-census.mjs");

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((line) => {
      if (line.trim().startsWith("//")) return "";
      const idx = line.indexOf("//");
      return idx === -1 || line.slice(0, idx).includes(":") ? line : line.slice(0, idx);
    })
    .join("\n");
}

const raw = readFileSync(FILE, "utf8");
const code = stripComments(raw);

/** The body of one top-level `const <name> = ...` inside the page evaluator. */
function constBody(source: string, name: string): string {
  const start = source.indexOf(`const ${name} =`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  const next = source.indexOf("\n  const ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

describe("control-surface census resolves accessible names properly", () => {
  it("finds the extractor it is guarding (else every rule below is vacuous)", () => {
    expect(code).toContain("const nameOf =");
    expect(code).toContain("collectControls");
  });

  it("consults all three label sources an accessibility API uses", () => {
    const label = constBody(code, "labelTextFor");
    expect(label).toContain("aria-labelledby");
    expect(label).toContain("label[for=");
    expect(label).toContain('el.closest("label")');
  });

  it("takes the label's own text, with the control it labels removed", () => {
    const label = constBody(code, "labelTextFor");
    // A label that WRAPS its control has the control's own text inside it -- a
    // <select> contributes every <option>. Reading `label.textContent` directly
    // produced names like
    //   "StatusAll statusespendingmanager approvedhr approved..."
    // which is the control's data spliced onto its label, and it filled the gap
    // report with rows that are not names at all.
    expect(label).toContain("cloneNode");
    expect(label).toMatch(/querySelectorAll\(\s*"select, input, textarea/);
    // The label branch must go through the stripping helper, not straight to
    // textContent -- an otherwise-identical helper that skipped it would pass
    // every other assertion here.
    expect(label).toContain("textOf(");
    expect(label).not.toMatch(/label\?\.textContent|label\.textContent/);
  });

  it("never falls back to a control's value", () => {
    const name = constBody(code, "nameOf");
    // The whole point. `el.value` reappearing here re-breaks both the gap
    // report and the unnamed-control count in one edit.
    expect(name).not.toMatch(/\bel\.value\b/);
  });

  it("still keeps the earlier img-alt fix, so this is not a regression swap", () => {
    // The extractor has been wrong here before, in the other direction: a logo
    // link wrapping <Image alt="BEEPA"> came back unnamed and was reported as
    // an accessibility defect in the product. Removing `img[alt]` would trade
    // one wrong answer for another.
    const name = constBody(code, "nameOf");
    expect(name).toContain("img[alt]");
  });

  it("proves stripComments is load-bearing rather than silently passing", () => {
    // Both the source comment and this file name `el.value`. Without the strip,
    // the negative assertion above would match the prose documenting the fix.
    expect(raw).toContain("el.value");
    expect(code).not.toContain("el.value");
  });
});