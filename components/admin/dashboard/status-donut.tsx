"use client";

import { Cell, Label, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { statusTone, type Tone } from "@/components/admin/ui/status-badge";
import { EmptyState } from "@/components/admin/ui/empty-state";

const TONE_VAR: Record<Tone, string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  info: "var(--color-info)",
  danger: "var(--color-error)",
  brand: "var(--color-brand)",
  neutral: "var(--color-text-subtle)",
};

/** Donut breakdown of a status distribution, coloured by status tone. */
export function StatusDonut({
  data,
  emptyLabel = "No data yet",
}: {
  data: { status: string; count: number }[];
  emptyLabel?: string;
}) {
  if (!data.length || data.every((d) => d.count === 0)) {
    return <EmptyState title={emptyLabel} className="py-10" />;
  }

  const total = data.reduce((s, d) => s + d.count, 0);
  const slices = data.map((d) => ({
    ...d,
    label: d.status.replace(/_/g, " "),
    fill: TONE_VAR[statusTone(d.status)],
  }));

  const config: ChartConfig = Object.fromEntries(
    slices.map((s) => [s.status, { label: s.label, color: s.fill }]),
  );

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 sm:flex-row">
      <ChartContainer config={config} className="aspect-square h-[180px]">
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent nameKey="label" hideLabel />}
          />
          <Pie
            data={slices}
            dataKey="count"
            nameKey="label"
            innerRadius={52}
            outerRadius={80}
            strokeWidth={2}
            stroke="var(--color-surface)"
          >
            {slices.map((s) => (
              <Cell key={s.status} fill={s.fill} />
            ))}
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox)) return null;
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) - 4}
                      className="fill-foreground text-xl font-bold"
                    >
                      {total}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 16}
                      className="fill-muted-foreground text-[0.65rem]"
                    >
                      total
                    </tspan>
                  </text>
                );
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>

      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 sm:flex sm:flex-col">
        {slices.map((s) => (
          <li
            key={s.status}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: s.fill }}
              />
              <span className="text-muted-foreground truncate capitalize">
                {s.label}
              </span>
            </span>
            <span className="text-foreground font-medium tabular-nums">
              {s.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
