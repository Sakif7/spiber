import { cn } from "@/lib/cn";

/**
 * Standard admin page header: a title, optional description, and a right-aligned
 * action slot (e.g. a "New X" button). Used on every admin page so the top of
 * the content area is consistent.
 */
export function AdminPageHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1
          className="text-foreground text-xl font-bold tracking-tight sm:text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      )}
    </div>
  );
}
