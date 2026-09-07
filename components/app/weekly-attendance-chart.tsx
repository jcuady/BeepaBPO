"use client";

import { Bar, BarChart, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type WeeklyBar = {
  day: string;
  hours: number;
  status: string;
};

const chartConfig = {
  hours: { label: "Hours", color: "#119446" },
} satisfies ChartConfig;

export function WeeklyAttendanceChart({ data }: { data: WeeklyBar[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="hours" fill="var(--color-hours)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
