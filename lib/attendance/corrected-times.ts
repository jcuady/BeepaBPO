/**
 * Clock-time resolution for approved attendance corrections.
 *
 * A correction request may change only one of the two clock times. Resolving
 * the effective pair therefore has to merge the requested values over the
 * record's current ones.
 *
 * This matters because payroll reads `worked_minutes` directly. Computing it
 * from the request alone yields null whenever just one side was requested,
 * which would leave the corrected clock times paired with a stale worked_minutes
 * and pay the wrong hours. See `reviewAttendanceCorrection`.
 *
 * Pure and dependency-free so the arithmetic can be tested directly.
 */

import { zonedWorkDateTime } from "@/lib/attendance/zoned-time";

/**
 * Turn the naive `datetime-local` value a correction form submits into a real
 * instant in the employee's own timezone.
 *
 * This is the bug this file existed to prevent, reintroduced one module over.
 * `upsertAttendanceRecord` builds its timestamps with `zonedWorkDateTime`, so
 * manual entry was fixed when `zoned-time.ts` was written. The correction path
 * kept passing the browser's naive string straight through, and Postgres casts a
 * bare timestamp as UTC regardless of where the app runs. Measured on the demo
 * tenant: an employee asked for a corrected shift of 08:00-17:00 Manila, and the
 * row was written as `08:00Z` / `17:00Z`, which display as 4:00 PM and 1:00 AM.
 *
 * `worked_minutes` still came out at 540 because both endpoints moved together,
 * so payroll hours looked correct while every displayed time was wrong. Rules
 * anchored to a wall clock — overtime after 18:00, a night differential — read
 * the wrong hours.
 *
 * The date is taken from the submitted value rather than the record's `work_date`,
 * so a correction that also moves the day still lands on the day asked for.
 *
 * Returns null when the string is not a recognisable `YYYY-MM-DDTHH:mm`, which
 * leaves the caller to store it as-is rather than inventing an instant.
 */
export function naiveDateTimeToZoned(
  naive: string | null | undefined,
  timeZone: string,
): string | null {
  if (!naive) return null;
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2})/.exec(naive.trim());
  if (!match) return null;
  return zonedWorkDateTime(match[1], match[2], timeZone);
}

export function workedMinutesBetween(
  clockInAt: string | null,
  clockOutAt: string | null,
): number | null {
  if (!clockInAt || !clockOutAt) return null;
  const start = Date.parse(clockInAt);
  const end = Date.parse(clockOutAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.max(0, Math.round((end - start) / 60_000));
}

export type ClockTimes = {
  clock_in_at?: string | null;
  clock_out_at?: string | null;
};

export type CorrectionPatch =
  | {
      ok: true;
      /** Only the columns that actually change, ready for a table update. */
      patch: {
        clock_in_at?: string;
        clock_out_at?: string;
        worked_minutes?: number;
      };
      clockIn: string | null;
      clockOut: string | null;
    }
  | { ok: false; error: string };

export function resolveCorrectedClockTimes(
  current: ClockTimes | null | undefined,
  requested: ClockTimes,
): CorrectionPatch {
  const clockIn = requested.clock_in_at ?? current?.clock_in_at ?? null;
  const clockOut = requested.clock_out_at ?? current?.clock_out_at ?? null;

  if (clockIn && clockOut) {
    const start = Date.parse(clockIn);
    const end = Date.parse(clockOut);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return { ok: false, error: "Corrected clock times are not valid timestamps." };
    }
    if (end <= start) {
      return { ok: false, error: "Corrected clock out must be after clock in." };
    }
  }

  const worked = workedMinutesBetween(clockIn, clockOut);

  return {
    ok: true,
    clockIn,
    clockOut,
    patch: {
      ...(requested.clock_in_at ? { clock_in_at: requested.clock_in_at } : {}),
      ...(requested.clock_out_at ? { clock_out_at: requested.clock_out_at } : {}),
      // Derived from the effective pair, so a one-sided correction still
      // refreshes worked_minutes instead of leaving payroll on stale hours.
      ...(worked !== null ? { worked_minutes: worked } : {}),
    },
  };
}