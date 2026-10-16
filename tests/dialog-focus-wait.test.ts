import { describe, it, expect } from "vitest";
import {
  waitForFocusInside,
  DEFAULT_TIMEOUT_MS,
} from "../scripts/audit/lib/wait-for-focus.mjs";

// The helper exists to stop `qa-probe-dialog-keyboard.mjs` reporting a defect
// that is only a 2ms race. The obvious way to write it wrong is a poll that
// cannot fail — wait a while, then return true because a dialog *usually*
// takes focus. Such a helper is indistinguishable from one that always passes,
// so every test below drives the failure leg explicitly.

/** Fake clock: advancing `now()` is the only way time passes. */
function fakeClock() {
  let t = 0;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("waitForFocusInside", () => {
  it("returns inside=false when focus NEVER arrives — the leg that must not be lost", async () => {
    const clock = fakeClock();
    const result = await waitForFocusInside(async () => false, {
      timeoutMs: 200,
      intervalMs: 20,
      sleep: async (ms) => clock.advance(ms),
      now: clock.now,
    });

    expect(result.inside).toBe(false);
    expect(result.waitedMs).toBeGreaterThanOrEqual(200);
    expect(result.samples).toBeGreaterThan(1);
  });

  it("does not report success merely because it waited", async () => {
    // Same as above, but assert the loop actually kept sampling to the bound
    // rather than bailing out early on the first miss.
    const clock = fakeClock();
    let calls = 0;
    await waitForFocusInside(async () => {
      calls += 1;
      return false;
    }, {
      timeoutMs: 300,
      intervalMs: 20,
      sleep: async (ms) => clock.advance(ms),
      now: clock.now,
    });

    expect(calls).toBe(16); // t=0,20,...,300 inclusive
  });

  it("returns inside=true as soon as focus lands, without waiting out the bound", async () => {
    const clock = fakeClock();
    const readings = [false, false, true];
    let i = 0;
    const result = await waitForFocusInside(async () => readings[i++] ?? true, {
      timeoutMs: 5000,
      intervalMs: 20,
      sleep: async (ms) => clock.advance(ms),
      now: clock.now,
    });

    expect(result.inside).toBe(true);
    expect(result.waitedMs).toBe(40); // two misses, then a hit
    expect(result.samples).toBe(3);
  });

  it("samples once and returns when focus is already inside", async () => {
    const clock = fakeClock();
    let calls = 0;
    const result = await waitForFocusInside(async () => {
      calls += 1;
      return true;
    }, {
      timeoutMs: 5000,
      sleep: async (ms) => clock.advance(ms),
      now: clock.now,
    });

    expect(result.inside).toBe(true);
    expect(calls).toBe(1);
    expect(result.waitedMs).toBe(0);
  });

  it("keeps its default bound short enough to be a user-perceptible wait", () => {
    // If this grows to seconds, a genuinely stuck dialog takes seconds to be
    // reported and the evidence stops describing the user experience.
    expect(DEFAULT_TIMEOUT_MS).toBeLessThanOrEqual(2000);
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThanOrEqual(500);
  });

  it("tolerates a focus target that appears a frame or two after the dialog", async () => {
    // The real sequence measured on this app: visible at +25ms, focus at +27ms.
    // Model the dialog existing but focus still on the trigger for two samples.
    const clock = fakeClock();
    const timeline = [
      { dialogVisible: true, focusedInside: false },
      { dialogVisible: true, focusedInside: false },
      { dialogVisible: true, focusedInside: true },
    ];
    let i = 0;
    const result = await waitForFocusInside(async () => timeline[i++]?.focusedInside ?? false, {
      intervalMs: 20,
      sleep: async (ms) => clock.advance(ms),
      now: clock.now,
    });

    expect(result.inside).toBe(true);
    expect(result.samples).toBe(3);
  });
});
