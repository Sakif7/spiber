"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const config = {
  count: { label: "New records", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Vertical bar chart of new records per pipeline over the last 30 days. */
export function ActivityChart({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <BarChart data={data} margin={{ top: 8, right: 8 }}>
        <CartesianGrid
          vertical={false}
          strokeDasharray="3 3"
          stroke="var(--color-border)"
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-32}
          textAnchor="end"
          height={64}
          tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={30}
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar
          dataKey="count"
          fill="var(--color-count)"
          radius={[6, 6, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ChartContainer>
  );
}
