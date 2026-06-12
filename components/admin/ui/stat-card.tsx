import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { Tone } from "./status-badge";

const TONE_VAR: Record<Tone, string> = {
  success: "--color-success",
  warning: "--color-warning",
  info: "--color-info",
  danger: "--color-error",
  brand: "--color-brand",
  neutral: "--color-text-muted",
};

export type StatTrend = {
  direction: "up" | "down" | "flat";
  value: string;
  /** Whether an "up" trend is good (green) or bad (red). Defaults to good. */
  goodWhenUp?: boolean;
};

/** Dashboard KPI tile: icon chip, label, value, optional trend pill. */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "brand",
  trend,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  trend?: StatTrend;
  hint?: string;
  className?: string;
}) {
  const v = `var(${TONE_VAR[tone]})`;

  let trendColor = "var(--color-text-muted)";
  if (trend && trend.direction !== "flat") {
    const goodUp = trend.goodWhenUp ?? true;
    const isGood = trend.direction === "up" ? goodUp : !goodUp;
    trendColor = isGood ? "var(--color-success)" : "var(--color-error)";
  }
  const TrendIcon =
    trend?.direction === "up"
      ? ArrowUpRight
      : trend?.direction === "down"
        ? ArrowDownRight
        : Minus;

  return (
    <Card
      className={cn(
        "group h-full gap-0 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className="grid size-10 place-items-center rounded-xl"
          style={{
            color: v,
            backgroundColor: `color-mix(in srgb, ${v} 14%, transparent)`,
          }}
        >
          <Icon className="size-5" strokeWidth={2} />
        </span>
        {trend && (
          <span
            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium"
            style={{
              color: trendColor,
              backgroundColor: `color-mix(in srgb, ${trendColor} 12%, transparent)`,
            }}
          >
            <TrendIcon className="size-3" />
            {trend.value}
          </span>
        )}
      </div>
      <p className="text-muted-foreground mt-4 font-mono text-[0.7rem] tracking-[0.12em] uppercase">
        {label}
      </p>
      <p
        className="text-foreground mt-1 text-2xl leading-tight font-bold"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </p>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </Card>
  );
}
