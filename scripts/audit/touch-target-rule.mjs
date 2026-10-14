/**
 * WCAG 2.5.8 Target Size (Minimum) — the single decision, extracted.
 *
 * Exists so this rule can be unit-tested. It was previously inline inside the
 * Playwright probe in `audit-responsive.mjs`, which means importing it to test
 * would also run the entire audit against a live server — so it had no test at
 * all, and the "is this exemption safe?" question could only be answered by
 * reading it.
 *
 * The exemption implements WCAG's own "Equivalent" clause: a target passes when
 * the same function is available through a different control that does meet the
 * minimum. A checkbox is the standard case — the visible box is 20x20 and the
 * real input is 1x1, but the wrapping label takes the click and is `min-h-11`.
 *
 * It is deliberately narrow. All three conditions must hold:
 *   1. a label exists,
 *   2. that label's own box is at least 44x44,
 *   3. it actually activates this control (`for` matches, or it contains it).
 *
 * Remove the label, shrink it, or point it at a different control and the
 * exemption stops firing and the target is reported again.
 */

export const MIN_TARGET_PX = 44;

export function isLabelEquivalentlySized({ labelRect, activates }) {
  if (!labelRect || !activates) return false;
  return labelRect.width >= MIN_TARGET_PX && labelRect.height >= MIN_TARGET_PX;
}

/**
 * @param {{width:number,height:number}} rect      the measured target
 * @param {{labelRect?:{width:number,height:number}|null, activates?:boolean}} opts
 */
export function passesTouchTarget(rect, { labelRect = null, activates = false } = {}) {
  if (isLabelEquivalentlySized({ labelRect, activates })) return true;
  return rect.width >= MIN_TARGET_PX && rect.height >= MIN_TARGET_PX;
}