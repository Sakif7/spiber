"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const config = {
  earnings: { label: "Earnings (৳)", color: "var(--chart-1)" },
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

/** 30-day net-earnings area chart for the seller dashboard (zero-filled). */
export function SellerSalesChart({
  data,
}: {
  data: { day: string; earningsMinor: number }[];
}) {
  const chartData = data.map((d) => ({
    label: fmtDay(d.day),
    earnings: Math.round(d.earningsMinor / 100),
  }));

  return (
    <ChartContainer config={config} className="h-[220px] w-full">
      <AreaChart data={chartData} margin={{ left: 4, right: 10, top: 10 }}>
        <defs>
          <linearGradient id="sellerEarningsFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-earnings)"
              stopOpacity={0.35}
            />
            <stop
              offset="95%"
              stopColor="var(--color-earnings)"
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
          dataKey="earnings"
          type="monotone"
          stroke="var(--color-earnings)"
          strokeWidth={2}
          fill="url(#sellerEarningsFill)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
