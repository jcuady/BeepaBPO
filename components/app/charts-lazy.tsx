"use client";

import dynamic from "next/dynamic";

/** Defer Recharts until the dashboard chart mounts (keeps initial client JS lighter). */
export const WeeklyAttendanceChartLazy = dynamic(
  () =>
    import("@/components/app/weekly-attendance-chart").then(
      (m) => m.WeeklyAttendanceChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 animate-pulse rounded-xl bg-mist" aria-hidden />
    ),
  },
);

export const TeamStatusDonutLazy = dynamic(
  () =>
    import("@/components/app/team-status-donut").then((m) => m.TeamStatusDonut),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 animate-pulse rounded-xl bg-mist" aria-hidden />
    ),
  },
);
