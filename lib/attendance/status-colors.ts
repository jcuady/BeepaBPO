/**
 * Attendance status colours.
 *
 * The same four-colour categorical palette was written out three times: in
 * `team-status-donut.tsx`, in the client dashboard, and (with different names)
 * in the attendance heatmap. Three copies of one decision, and the design audit
 * found them because the third arrived with a different hex for "Rest / holiday"
 * that the other two did not have.
 *
 * Series colours are assigned from `--color-series-*` in index order. That ramp
 * exists because the brand palette cannot supply four mutually distinguishable
 * chart series — navy/green/lime are three colours, not four, and reusing green
 * for two series is exactly the mistake that makes a chart unreadable.
 */
export type AttendanceStatusColorKey =
  | "present"
  | "leave"
  | "rest"
  | "absent";

/** Series index per status. Do not reorder without updating the ramp. */
export const ATTENDANCE_SERIES: Record<AttendanceStatusColorKey, string> = {
  present: "var(--color-series-1)",
  leave: "var(--color-series-3)",
  rest: "var(--color-series-2)",
  absent: "var(--color-series-4)",
};

export const ATTENDANCE_SERIES_LABELS: Record<AttendanceStatusColorKey, string> = {
  present: "Present",
  leave: "On Leave",
  rest: "Rest / holiday",
  absent: "Absent",
};

/**
 * Attendance statuses that fold into the "rest" series.
 *
 * `rest_day` and `holiday` are both non-working days and were previously drawn
 * as a single slice; keeping them merged means the donut's series count stays
 * stable across weeks, so a viewer is not re-learning the legend every Monday.
 */
export const REST_STATUSES: readonly string[] = ["rest_day", "holiday"];

/** Statuses that count as not-present for the "absent" slice. */
export const ABSENT_STATUSES: readonly string[] = ["absent", "incomplete"];