// Poll until focus lands inside an element — or admit it never will.
//
// WHY: a dialog that has just mounted is not a dialog that has taken focus yet.
// Base UI moves focus in an effect that runs after the popup is attached, so the
// exact instant `waitForSelector(..., { state: "visible" })` resolves, focus is
// still on the trigger. Measured on this app: the dialog is visible at +25ms and
// focus lands at +27ms. Sampling once in that window reports a defect that does
// not exist — and did so, failing a probe that had passed days earlier purely
// because the machine was slower.
//
// WHY NOT to "fix" it by deleting the assertion: losing focus into a modal is a
// real, invisible-to-every-other-check failure, and this dialog guards 21
// irreversible mutations with no X to escape to.
//
// The wait is bounded and the bound is reported. A dialog that takes focus
// eventually PASSES; one that never does still FAILS, and one that takes longer
// than a user would tolerate is visible in the evidence instead of being rounded
// away to PASS/FAIL.

const DEFAULT_TIMEOUT_MS = 1500;
const DEFAULT_INTERVAL_MS = 20;

/**
 * @param {() => Promise<boolean>} readInside  samples "is focus inside right now"
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs]  give up after this long and report false
 * @param {number} [opts.intervalMs]  delay between samples
 * @param {(ms:number)=>Promise<void>} [opts.sleep]  injectable, for tests
 * @param {() => number} [opts.now]  injectable clock, for tests
 * @returns {Promise<{inside:boolean, waitedMs:number, samples:number}>}
 */
export async function waitForFocusInside(readInside, opts = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    intervalMs = DEFAULT_INTERVAL_MS,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = () => Date.now(),
  } = opts;

  const start = now();
  let samples = 0;

  // Sample immediately: the common case is already correct by the time we look.
  for (;;) {
    samples += 1;
    if (await readInside()) {
      return { inside: true, waitedMs: now() - start, samples };
    }
    if (now() - start >= timeoutMs) {
      return { inside: false, waitedMs: now() - start, samples };
    }
    await sleep(intervalMs);
  }
}

export { DEFAULT_TIMEOUT_MS, DEFAULT_INTERVAL_MS };
