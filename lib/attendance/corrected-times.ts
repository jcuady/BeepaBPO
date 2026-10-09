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