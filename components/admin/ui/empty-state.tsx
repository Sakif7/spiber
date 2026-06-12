import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/cn";

/** Branded empty state for lists and panels. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <span className="bg-muted text-muted-foreground grid size-12 place-items-center rounded-full">
        <Icon className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="text-foreground font-medium">{title}</p>
        {description && (
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
