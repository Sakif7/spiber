"use client";

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/admin/ui/empty-state";

/** Reusable horizontal bar chart (category labels on the Y axis). */
export function HorizontalBars({
  data,
  color = "var(--chart-1)",
  height = 280,
  emptyLabel = "No data yet",
}: {
  data: { name: string; count: number }[];
  color?: string;
  height?: number;
  emptyLabel?: string;
}) {
  const config = {
    count: { label: "Count", color },
  } satisfies ChartConfig;

  if (!data.length) {
    return <EmptyState title={emptyLabel} className="py-10" />;
  }

  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 4, right: 28, top: 4, bottom: 4 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar
          dataKey="count"
          fill="var(--color-count)"
          radius={[0, 6, 6, 0]}
          barSize={18}
        >
          <LabelList
            dataKey="count"
            position="right"
            offset={8}
            style={{ fontSize: 11, fill: "var(--color-text-muted)" }}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
