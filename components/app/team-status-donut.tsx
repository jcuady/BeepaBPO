"use client";

import { Cell, Pie, PieChart } from "recharts";
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

const chartConfig = {
  present: { label: "Present", color: "#119446" },
  leave: { label: "On Leave", color: "#f59e0b" },
  wfh: { label: "WFH", color: "#0ea5e9" },
  absent: { label: "Absent", color: "#667085" },
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
