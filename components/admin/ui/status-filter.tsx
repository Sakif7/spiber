import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Pill row for filtering a list by status via a URL query param. The active
 * pill is filled with the brand color; the rest are quiet outlines.
 */
export function StatusFilterPills({
  statuses,
  active,
  basePath,
  param = "status",
  allValue = "all",
}: {
  statuses: readonly string[];
  active: string;
  basePath: string;
  param?: string;
  allValue?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((s) => {
        const isActive = (active || allValue) === s;
        const href = s === allValue ? basePath : `${basePath}?${param}=${s}`;
        return (
          <Link
            key={s}
            href={href}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {s.replace(/_/g, " ")}
          </Link>
        );
      })}
    </div>
  );
}
