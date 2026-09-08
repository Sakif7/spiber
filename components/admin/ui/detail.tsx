import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

/**
 * Shared building blocks for admin DETAIL pages (an order, a case, a
 * quotation, an application…). They all have the same anatomy: a wide main
 * column of read-only fact cards beside a narrower column of action panels.
 * These replace the `card` / `muted` / `Row` style objects each detail page
 * used to declare for itself.
 */

/** Main column + action sidebar; stacks on tablets and below. */
export function DetailLayout({
  children,
  aside,
  className,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid items-start gap-4",
        aside && "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]",
        className,
      )}
    >
      <div className="grid min-w-0 gap-4">{children}</div>
      {aside && <div className="grid min-w-0 gap-4">{aside}</div>}
    </div>
  );
}

/** A titled block of facts. Omit the title for a plain card. */
export function DetailCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("gap-0 p-0", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-foreground text-sm font-semibold">{title}</h2>
            )}
            {description && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn("grid gap-2 px-4 py-3", bodyClassName)}>
        {children}
      </div>
    </Card>
  );
}

/** One `label … value` line inside a DetailCard. */
export function DetailRow({
  label,
  children,
  mono,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  /** Render the value in the mono face (references, keys, SKUs). */
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span
        className={cn(
          "text-foreground min-w-0 text-right font-medium break-words",
          mono && "font-mono text-xs",
        )}
      >
        {children}
      </span>
    </div>
  );
}

/** The mono reference line under a detail-page title. */
export function DetailMeta({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-muted-foreground font-mono text-xs", className)}>
      {children}
    </p>
  );
}

/** Free-form prose inside a detail card (a message, a note body). */
export function DetailProse({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-foreground whitespace-pre-line", className)}>
      {children}
    </p>
  );
}
