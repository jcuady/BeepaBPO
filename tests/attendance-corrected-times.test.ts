import { describe, expect, it } from "vitest";
import {
  resolveCorrectedClockTimes,
  workedMinutesBetween,
} from "../lib/attendance/corrected-times";

const IN = "2026-09-15T08:00:00.000Z";
const OUT = "2026-09-15T17:00:00.000Z";

describe("workedMinutesBetween", () => {
  it("returns the elapsed minutes", () => {
    expect(workedMinutesBetween(IN, OUT)).toBe(540);
  });

  it("returns null when either side is missing", () => {
    expect(workedMinutesBetween(null, OUT)).toBeNull();
    expect(workedMinutesBetween(IN, null)).toBeNull();
    expect(workedMinutesBetween(null, null)).toBeNull();
  });

  it("returns null rather than a negative span", () => {
    expect(workedMinutesBetween(OUT, IN)).toBeNull();
  });

  it("returns null for unparseable timestamps", () => {
    expect(workedMinutesBetween("not-a-date", OUT)).toBeNull();
  });
});

describe("resolveCorrectedClockTimes", () => {
  const current = { clock_in_at: IN, clock_out_at: OUT };

  it("recomputes worked_minutes when both times are corrected", () => {
    const result = resolveCorrectedClockTimes(current, {
      clock_in_at: "2026-09-15T09:00:00.000Z",
      clock_out_at: "2026-09-15T18:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).toEqual({
      clock_in_at: "2026-09-15T09:00:00.000Z",
      clock_out_at: "2026-09-15T18:00:00.000Z",
      worked_minutes: 540,
    });
  });

  it("refreshes worked_minutes when only clock_out is corrected", () => {
    // The regression this guards: the original code computed worked minutes from
    // the request alone, so a one-sided correction returned null and left
    // payroll reading the pre-correction hours alongside the new clock-out.
    const result = resolveCorrectedClockTimes(current, {
      clock_out_at: "2026-09-15T19:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch.clock_out_at).toBe("2026-09-15T19:00:00.000Z");
    expect(result.patch.clock_in_at).toBeUndefined();
    expect(result.patch.worked_minutes).toBe(660);
  });

  it("refreshes worked_minutes when only clock_in is corrected", () => {
    const result = resolveCorrectedClockTimes(current, {
      clock_in_at: "2026-09-15T07:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch.clock_out_at).toBeUndefined();
    expect(result.patch.worked_minutes).toBe(600);
  });

  it("refuses a correction that would invert the pair", () => {
    const result = resolveCorrectedClockTimes(current, {
      clock_out_at: "2026-09-15T06:00:00.000Z",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/after clock in/i);
  });

  it("refuses a correction with an equal clock_in and clock_out", () => {
    const result = resolveCorrectedClockTimes(current, {
      clock_out_at: IN,
    });
    expect(result.ok).toBe(false);
  });

  it("refuses unparseable requested timestamps", () => {
    const result = resolveCorrectedClockTimes(current, {
      clock_out_at: "garbage",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/valid timestamps/i);
  });

  it("omits worked_minutes when the effective pair is still incomplete", () => {
    // Nothing to derive from yet — leave payroll to read whatever it reads now
    // rather than writing a misleading zero.
    const result = resolveCorrectedClockTimes(
      { clock_in_at: IN, clock_out_at: null },
      { clock_out_at: null },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch.worked_minutes).toBeUndefined();
  });

  it("tolerates a missing current record", () => {
    const result = resolveCorrectedClockTimes(null, {
      clock_in_at: IN,
      clock_out_at: OUT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch.worked_minutes).toBe(540);
  });

  it("does not overwrite a stored value with null", () => {
    const result = resolveCorrectedClockTimes(current, {
      clock_in_at: null,
      clock_out_at: "2026-09-15T19:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toHaveProperty("clock_in_at");
    expect(result.clockIn).toBe(IN);
  });
});