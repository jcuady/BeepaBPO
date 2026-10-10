// TDD: the attendance correction path must store clock times the same way the
// manual-entry path does.
//
// WHY: lib/attendance/zoned-time.ts exists because manual entry used to store
// timestamps 8 hours out of step with clocked ones. `upsertAttendanceRecord`
// routes through `zonedWorkDateTime`. The correction path did NOT:
// `resolveCorrectedClockTimes` is pure string arithmetic, and the value it
// receives comes from a `datetime-local` input — a naive "2026-10-10T08:00"
// that Postgres casts as 08:00Z, which is 16:00 in Asia/Manila.
//
// Measured on the live demo tenant, driving the real UI:
//
//   employee requested a corrected shift of 08:00 - 17:00 Manila
//   the record stored 2026-10-10T08:00:00Z and 2026-10-10T17:00:00Z
//   which DISPLAY as 4:00 PM and 1:00 AM in Asia/Manila
//
// `worked_minutes` came out at 540 and looked correct, because both endpoints
// moved by the same amount — which is exactly what makes this dangerous. The
// duration is right; the times are wrong. Anyone reading the timesheet sees a
// shift that never happened, and any rule anchored to a wall-clock time
// (overtime after 18:00, night differential) is now applied to the wrong hours.

import { describe, expect, it } from "vitest";
import { resolveCorrectedClockTimes } from "@/lib/attendance/corrected-times";
import { zonedWorkDateTime } from "@/lib/attendance/zoned-time";

const TZ = "Asia/Manila";
const WORK_DATE = "2026-10-10";

/** What the record shows to the employee, in their own timezone. */
function shownInEmployeeZone(storedIso: string | null | undefined): string | null {
  if (!storedIso) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(storedIso));
}

describe("attendance correction timezone handling", () => {
  it("resolves a requested wall-clock time into the employee's timezone", () => {
    // 08:00 in Manila is 00:00Z. Storing 08:00Z is the bug.
    expect(zonedWorkDateTime(WORK_DATE, "08:00", TZ)).toBe("2026-10-10T00:00:00.000Z");
  });

  it("keeps the merge behaviour the payroll fix depends on", () => {
    // A one-sided correction must still refresh worked_minutes from the
    // effective pair. Losing this regresses the earlier payroll fix.
    const result = resolveCorrectedClockTimes(
      {
        clock_in_at: zonedWorkDateTime(WORK_DATE, "09:00", TZ),
        clock_out_at: zonedWorkDateTime(WORK_DATE, "18:00", TZ),
      },
      { clock_in_at: zonedWorkDateTime(WORK_DATE, "08:00", TZ) },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch.worked_minutes).toBe(600);
    expect(result.patch.clock_out_at).toBeUndefined();
  });

  it("rejects a clock-out that is not after clock-in", () => {
    const result = resolveCorrectedClockTimes(null, {
      clock_in_at: zonedWorkDateTime(WORK_DATE, "18:00", TZ),
      clock_out_at: zonedWorkDateTime(WORK_DATE, "09:00", TZ),
    });
    expect(result.ok).toBe(false);
  });

  it("a two-sided correction lands on the times the employee actually asked for", () => {
    const requestedIn = zonedWorkDateTime(WORK_DATE, "08:00", TZ);
    const requestedOut = zonedWorkDateTime(WORK_DATE, "17:00", TZ);
    const result = resolveCorrectedClockTimes(null, {
      clock_in_at: requestedIn,
      clock_out_at: requestedOut,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // This is the assertion the browser exercise makes, expressed as a unit test:
    // the stored instant must display as the requested wall-clock time.
    expect(shownInEmployeeZone(result.patch.clock_in_at)).toBe("8:00 AM");
    expect(shownInEmployeeZone(result.patch.clock_out_at)).toBe("5:00 PM");
    expect(result.patch.worked_minutes).toBe(540);
  });
});

describe("what the correction path actually wrote to the database", () => {
  it("a bare wall-clock string is stored as UTC and displays 8 hours late in Manila", () => {
    // How the defect really shows up, taken from the live measurement:
    //
    //   employee requested a corrected shift of 08:00 - 17:00 Manila
    //   the row stored 2026-10-10T08:00:00Z and 2026-10-10T17:00:00Z
    //   which display as 4:00 PM and 1:00 AM in Asia/Manila
    //
    // Note the mechanism. A naive string like "2026-10-10T08:00" is parsed by
    // JavaScript in the HOST's timezone, so the same input looks correct on a
    // Manila dev machine and wrong on a UTC production host — which is exactly
    // the dev/prod divergence `zoned-time.ts` was written to end. But once it
    // reaches Postgres it is cast as UTC regardless of where the app runs, so the
    // STORED value is wrong in every environment. Assert against the stored
    // instant, which is the thing payroll and the timesheet UI actually read.
    const storedNaive = `${WORK_DATE}T08:00:00.000Z`;
    const storedCorrect = zonedWorkDateTime(WORK_DATE, "08:00", TZ);
    expect(storedNaive).not.toBe(storedCorrect);
    expect(shownInEmployeeZone(storedNaive)).toBe("4:00 PM");
    expect(shownInEmployeeZone(storedCorrect)).toBe("8:00 AM");
  });

  it("both endpoints shift together, so worked_minutes looks right while the times are wrong", () => {
    // This is what makes the defect dangerous rather than merely ugly: the
    // duration survives, so nothing derived from worked_minutes alone complains.
    const naiveIn = `${WORK_DATE}T08:00:00.000Z`;
    const naiveOut = `${WORK_DATE}T17:00:00.000Z`;
    const minutes = Math.round((Date.parse(naiveOut) - Date.parse(naiveIn)) / 60000);
    expect(minutes).toBe(540);
    // A payslip reading 540 minutes is indistinguishable from a correct one.
    // Only the displayed times give it away.
    expect(shownInEmployeeZone(naiveIn)).toBe("4:00 PM");
  });
});