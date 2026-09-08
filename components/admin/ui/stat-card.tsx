import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { Tone } from "./status-badge";
import { TONE_FILL, TONE_TEXT } from "./tone";

export type StatTrend = {
  direction: "up" | "down" | "flat";
  value: string;
  /** Whether an"up" trend is good (green) or bad (red). Defaults to good. */
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
  // A flat trend is not news, so it stays in the muted neutral tone.
  let trendTone: Tone = "neutral";
  if (trend && trend.direction !== "flat") {
    const goodUp = trend.goodWhenUp ?? true;
    const isGood = trend.direction === "up" ? goodUp : !goodUp;
    trendTone = isGood ? "success" : "danger";
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
          className={cn(
            "grid size-8 place-items-center rounded-lg",
            TONE_TEXT[tone],
            TONE_FILL[tone],
          )}
        >
          <Icon className="size-4" strokeWidth={2} />
        </span>
        {trend && (
          <span
            className={cn(
              "text-admin-2xs inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
              TONE_TEXT[trendTone],
              TONE_FILL[trendTone],
            )}
          >
            <TrendIcon className="size-3" />
            {trend.value}
          </span>
        )}
      </div>
      <p className="text-muted-foreground mt-3 font-mono text-[0.65rem] tracking-[0.12em] uppercase">
        {label}
      </p>
      <p className="text-foreground mt-0.5 text-xl leading-tight font-bold">
        {value}
      </p>
      {hint && (
        <p className="text-muted-foreground text-admin-xs mt-0.5">{hint}</p>
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
