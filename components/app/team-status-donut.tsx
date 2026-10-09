"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ATTENDANCE_SERIES,
  ATTENDANCE_SERIES_LABELS,
} from "@/lib/attendance/status-colors";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type DonutSlice = {
  name: string;
  value: number;
  fill: string;
};

// Colours come from the shared attendance series, not a local copy — this
// palette was previously duplicated here, in the client dashboard, and in the
// heatmap, and the copies had already begun to disagree.
const chartConfig = {
  present: { label: ATTENDANCE_SERIES_LABELS.present, color: ATTENDANCE_SERIES.present },
  leave: { label: ATTENDANCE_SERIES_LABELS.leave, color: ATTENDANCE_SERIES.leave },
  wfh: { label: "WFH", color: ATTENDANCE_SERIES.rest },
  absent: { label: ATTENDANCE_SERIES_LABELS.absent, color: ATTENDANCE_SERIES.absent },
} satisfies ChartConfig;

export function TeamStatusDonut({ data }: { data: DonutSlice[] }) {
  if (data.every((d) => d.value === 0)) {
    return (
      <p className="py-8 text-center text-sm text-slate">No team data yet.</p>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square h-52">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={50}
          outerRadius={72}
          strokeWidth={2}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
      </PieChart>
    </ChartContainer>
  );
}
