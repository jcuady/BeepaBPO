/**
 * Submit a form in a way that carries what was typed, and that waits for the
 * OUTCOME rather than for a duration.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Four audit exercises signed in by filling a form and clicking submit. Two
 * defects were shared by all four, and both produced failures that read like
 * product bugs:
 *
 * 1. **Hydration resets the fields.** React hydrates after the server-rendered
 *    HTML is already interactive, and hydration clears the values `fill` just
 *    wrote. A click landing in that window submits an EMPTY form. The server
 *    then rejects it at schema validation -- `loginSchema` never reaches
 *    `signInWithPassword` -- and the user is told "Please check the form and
 *    try again."
 *
 *    This is the nastiest version of an unattributable failure, because every
 *    probe taken OUTSIDE the browser stays green. Measured on BeepoBeepa
 *    2026-10-17: `finance@demo.beepabpo.com` failed with correct credentials
 *    while `scripts/audit/test-auth-direct.mjs` returned HTTP 200 for all six
 *    demo accounts. The credentials were never sent, so the probe was honest
 *    and irrelevant at the same time.
 *
 * 2. **A duration is not an outcome.** `click` followed by `waitForTimeout(3500)`
 *    is long enough on a fast machine and short enough on a slow one, so what
 *    it measured was the machine's mood. The same exercise failed on four
 *    different accounts across four runs, none of them real.
 *
 * The fix is not a longer sleep. It is to read the field back and refuse to
 * submit a form that is not holding its values, and to wait for one of the two
 * facts a submit can produce: the session exists, or the app published why not.
 *
 * WHY IT IS SHARED
 * ----------------
 * The error-message family in `lib/auth/error-messages.ts` grew four separate
 * mappers before a header comment had to warn that the *next* mapper would
 * invent a fifth reading of a status three others already agreed on. This is
 * the same failure one layer out: four copies of "fill, click, wait 3500ms"
 * will drift, and the one that drifts worst is the one nobody re-reads.
 */

/**
 * Fill a field and confirm it is still holding the value before returning.
 *
 * A value that survives a settle proves hydration has finished, because
 * hydration is the only thing that clears it -- which is what makes the
 * settle a guarantee rather than another hope.
 *
 * Throws rather than returning a failure. If a form will not hold its values
 * the exercise cannot measure anything, and a silent no-op here would be
 * absorbed downstream and published as a product failure.
 */
export async function fillHeld(
  page,
  locator,
  value,
  { attempts = 4, settle = 250 } = {},
) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await locator.fill(value);
    await page.waitForTimeout(settle);
    if ((await locator.inputValue()) === value) return attempt;
  }
  throw new Error(
    `a field would not hold its value after ${attempts} fills — hydration is ` +
      `clearing it faster than it can be written, so anything submitted now ` +
      `would not be what was typed`,
  );
}

/**
 * Fill several fields, each held, in order. Returns how many fill attempts the
 * worst field needed, so the number can be recorded as evidence rather than
 * discarded.
 */
export async function fillFormHeld(page, fields, options = {}) {
  let worst = 0;
  for (const [locator, value] of fields) {
    worst = Math.max(worst, await fillHeld(page, locator, value, options));
  }
  return worst;
}

/**
 * Click a submit button and wait for one of the two things that can follow.
 *
 * `alertSelector` is how the app says "no": every login form in this repo
 * renders `state.error` into a `<p role="alert">`. Resolving on that element
 * rather than on a timer is what lets the caller tell "the credentials were
 * refused" apart from "the redirect is still in flight" -- which were
 * indistinguishable for a day.
 *
 * Returns `"alert"`, `"navigated"`, or `"timeout"`; never throws, because a
 * refusal is a legitimate measurement and only a broken probe is an error.
 */
export async function submitAndWaitOutcome(
  page,
  buttonSelector,
  { loginPath, timeout = 20000, alertSelector = '[role="alert"]' } = {},
) {
  await page.click(buttonSelector);
  if (!loginPath) {
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    return "navigated";
  }
  try {
    await page.waitForFunction(
      ([path, alert]) =>
        !location.pathname.startsWith(path) || !!document.querySelector(alert),
      [loginPath, alertSelector],
      { timeout },
    );
    return (await page.locator(alertSelector).count()) > 0 ? "alert" : "navigated";
  } catch {
    return "timeout";
  }
}