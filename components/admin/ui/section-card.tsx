import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

/**
 * A titled content card for admin detail/form sections. Optional header with a
 * title, description, and right-aligned action; content area below.
 */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card
      className={cn(
        "flex h-full flex-col gap-0 overflow-hidden py-0",
        className,
      )}
    >
      {(title || action) && (
        <div className="border-border/60 flex items-center justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0 space-y-0.5">
            {title && (
              <h2 className="text-foreground text-sm font-semibold">{title}</h2>
            )}
            {description && (
              <p className="text-muted-foreground text-xs">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </Card>
  );
}
