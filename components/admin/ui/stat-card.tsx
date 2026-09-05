import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Link } from "@/i18n/navigation";
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

/** Dashboard KPI tile: icon chip, label, value, optional trend pill. Pass
 *  `href` to make the whole tile a link to the page that explains the number. */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "brand",
  trend,
  hint,
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  trend?: StatTrend;
  hint?: string;
  href?: string;
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

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-lg"
          style={{
            color: v,
            backgroundColor: `color-mix(in srgb, ${v} 14%, transparent)`,
          }}
        >
          <Icon className="size-4" strokeWidth={2} />
        </span>
        {trend && (
          <span
            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium"
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
      <p className="text-muted-foreground mt-3 font-mono text-[0.65rem] tracking-[0.12em] uppercase">
        {label}
      </p>
      <p
        className="text-foreground mt-0.5 text-xl leading-tight font-bold"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </p>
      {hint && (
        <p className="text-muted-foreground mt-0.5 text-[12px]">{hint}</p>
      )}
    </>
  );

  const cardClass = cn(
    "group h-full gap-0 p-4 transition-all duration-200",
    href && "hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]",
    className,
  );

  return href ? (
    <Card className={cardClass}>
      <Link
        href={href}
        className="focus-visible:ring-ring/50 -m-4 block rounded-lg p-4 outline-none focus-visible:ring-[3px]"
      >
        {body}
      </Link>
    </Card>
  ) : (
    <Card className={cardClass}>{body}</Card>
  );
}
