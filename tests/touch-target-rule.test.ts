import { describe, expect, it } from "vitest";
import {
  MIN_TARGET_PX,
  isLabelEquivalentlySized,
  passesTouchTarget,
} from "../scripts/audit/touch-target-rule.mjs";

/**
 * The touch-target rule is an *exemption*, and exemptions are the part of a
 * gate most likely to rot into a rubber stamp. Each case below removes one of
 * the three conditions and asserts the target is reported again, because the
 * failure mode that matters is the exemption quietly outliving its reason.
 */

const BIG = { width: 320, height: 44 }; // a `min-h-11` full-width label
const SMALL = { width: 40, height: 20 }; // a bare inline label
const TINY = { width: 20, height: 20 }; // the shadcn checkbox box
const GIANT = { width: 48, height: 48 };

describe("passesTouchTarget", () => {
  it("passes a target that is itself large enough", () => {
    expect(passesTouchTarget(GIANT)).toBe(true);
  });

  it("fails a small target with no label", () => {
    expect(passesTouchTarget(TINY)).toBe(false);
  });

  it("passes a small control when a 44px label activates it", () => {
    expect(passesTouchTarget(TINY, { labelRect: BIG, activates: true })).toBe(true);
  });

  it("fails when the label exists but is itself too small", () => {
    // The exemption exists because the *label* is the target. If the label is
    // undersized there is no larger equivalent, so nothing is exempt.
    expect(passesTouchTarget(TINY, { labelRect: SMALL, activates: true })).toBe(false);
  });

  it("fails when a large label exists but does not activate this control", () => {
    // A `for` pointing at a different id is not an equivalent target for this
    // one, however big it is.
    expect(passesTouchTarget(TINY, { labelRect: BIG, activates: false })).toBe(false);
  });

  it("fails when no label geometry was supplied at all", () => {
    expect(passesTouchTarget(TINY, { labelRect: null, activates: true })).toBe(false);
  });
});

describe("isLabelEquivalentlySized", () => {
  it("requires all three conditions", () => {
    expect(isLabelEquivalentlySized({ labelRect: BIG, activates: true })).toBe(true);
    expect(isLabelEquivalentlySized({ labelRect: BIG, activates: false })).toBe(false);
    expect(isLabelEquivalentlySized({ labelRect: SMALL, activates: true })).toBe(false);
    expect(isLabelEquivalentlySized({ labelRect: null, activates: true })).toBe(false);
  });
});

describe("the threshold is the WCAG one", () => {
  it("is 44px, and exactly at the line counts as a pass", () => {
    expect(MIN_TARGET_PX).toBe(44);
    expect(passesTouchTarget({ width: 44, height: 44 })).toBe(true);
    expect(passesTouchTarget({ width: 43.9, height: 44 })).toBe(false);
  });
});