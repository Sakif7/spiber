"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const config = {
  revenue: { label: "Revenue (৳)", color: "var(--chart-1)" },
  orders: { label: "Paid orders", color: "var(--chart-4)" },
} satisfies ChartConfig;

function fmtDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
function fmtCompact(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(n);
}

export function RevenueChart({
  data,
}: {
  data: { day: string; revenueMinor: number; orders: number }[];
}) {
  const chartData = data.map((d) => ({
    label: fmtDay(d.day),
    revenue: Math.round(d.revenueMinor / 100),
    orders: d.orders,
  }));

  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <AreaChart data={chartData} margin={{ left: 4, right: 10, top: 10 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-revenue)"
              stopOpacity={0.35}
            />
            <stop
              offset="95%"
              stopColor="var(--color-revenue)"
              stopOpacity={0.02}
            />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          strokeDasharray="3 3"
          stroke="var(--color-border)"
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
          tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={fmtCompact}
          tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="line" />}
        />
        <Area
          dataKey="revenue"
          type="monotone"
          stroke="var(--color-revenue)"
          strokeWidth={2}
          fill="url(#revenueFill)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
