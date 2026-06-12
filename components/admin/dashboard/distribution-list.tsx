import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/admin/ui/empty-state";

/**
 * A label + proportional bar + count list. Scales gracefully from one row to
 * many (unlike a sparse bar chart), and distributes evenly to fill the card
 * height so it matches the height of a chart card beside it.
 */
export function DistributionList({
  data,
  color = "var(--chart-1)",
  empty = "No data yet",
  className,
}: {
  data: { label: string; count: number }[];
  color?: string;
  empty?: string;
  className?: string;
}) {
  if (!data.length) {
    return <EmptyState title={empty} className="py-10" />;
  }
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <ul className={cn("flex h-full flex-col justify-between gap-3", className)}>
      {data.map((d) => (
        <li key={d.label} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground truncate capitalize">
              {d.label}
            </span>
            <span className="text-foreground font-medium tabular-nums">
              {d.count}
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(d.count / max) * 100}%`,
                minWidth: d.count > 0 ? 6 : 0,
                backgroundColor: color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
