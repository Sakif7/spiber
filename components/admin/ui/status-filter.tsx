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
  keep,
  label,
}: {
  statuses: readonly string[];
  active: string;
  basePath: string;
  param?: string;
  allValue?: string;
  /**
   * Other query params to carry across, so two pill rows on the same page
   * (e.g. status + storefront) don't clear each other.
   */
  keep?: Record<string, string | undefined>;
  /** Optional row caption, useful once a page has more than one filter. */
  label?: string;
}) {
  const hrefFor = (value: string) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(keep ?? {})) {
      if (v) qs.set(k, v);
    }
    if (value !== allValue) qs.set(param, value);
    else qs.delete(param);
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label ? (
        <span className="text-muted-foreground mr-1 text-xs font-medium">
          {label}
        </span>
      ) : null}
      {statuses.map((s) => {
        const isActive = (active || allValue) === s;
        const href = hrefFor(s);
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
