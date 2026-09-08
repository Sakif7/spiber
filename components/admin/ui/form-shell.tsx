import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

/**
 * The shared chrome for admin editors (product, course, post, software, …).
 *
 * Every editor is the same shape: a back link and title, a stack of titled
 * sections, and a save bar. These primitives replace the per-file inline
 * `field` / `row` / `sel` style objects each editor used to declare, so the
 * forms are consistent, themeable and dark-mode-correct by construction.
 */

/**
 * One height for every field's label row.
 *
 * A bare `<Label>` is shorter than a `LocalizedInput`'s label-plus-tab-strip
 * header, so pairing them in a two-column grid used to leave their inputs on
 * different baselines. Both render their label inside this row instead, which
 * is sized to the taller of the two, so the controls below always align.
 */
export const FIELD_LABEL_ROW = "flex min-h-6 flex-wrap items-center gap-2";

/** Back link + title + optional subtitle above an editor form. */
export function EditorHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  action,
}: {
  backHref: string;
  backLabel: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium"
        >
          <ArrowLeft className="size-3.5" />
          {backLabel}
        </Link>
        <h1 className="text-foreground truncate text-lg font-bold tracking-tight sm:text-xl">
          {title}
        </h1>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
      </div>
      {action && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {action}
        </div>
      )}
    </div>
  );
}

/** One titled block of an editor (Basics, Pricing & stock, Media, …). */
export function FormSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 p-0", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-foreground text-sm font-semibold">{title}</h2>
          {description && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="grid gap-4 px-4 py-4">{children}</div>
    </Card>
  );
}

/** Responsive column grid for form fields (collapses to one column on phones). */
export function FormGrid({
  cols = 2,
  children,
  className,
}: {
  cols?: 2 | 3;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // `items-start` so a taller cell (a hint line, a LocalizedInput tab
        // strip) can never bottom-align its neighbour and push that column
        // down. Paired with the shared label-row height in FormField, controls
        // in the same row share a baseline whatever the labels contain.
        "grid items-start gap-4",
        cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Label + control + optional hint. `htmlFor` wires the label to the control. */
export function FormField({
  label,
  htmlFor,
  hint,
  required,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      {label && (
        // FIELD_LABEL_ROW keeps every label row the same height, so a plain
        // label and a LocalizedInput's taller tab strip still put their
        // controls on one baseline.
        <div className={FIELD_LABEL_ROW}>
          <Label htmlFor={htmlFor}>
            {label}
            {required && <span className="text-destructive"> *</span>}
          </Label>
        </div>
      )}
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

/**
 * Sticky footer with the primary action, so Save is always reachable in a long
 * editor without scrolling to the bottom. Errors render beside it (the forms
 * surface Zod field messages through `formatApiError`).
 */
export function SaveBar({
  saving,
  onSave,
  saveLabel,
  savingLabel = "Saving…",
  error,
  children,
  disabled,
}: {
  saving?: boolean;
  onSave: () => void;
  saveLabel: string;
  savingLabel?: string;
  error?: string | null;
  /** Secondary actions rendered to the left of Save. */
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="bg-background/85 sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-3 border-t px-1 py-3 backdrop-blur">
      {error && (
        <p
          role="alert"
          className="text-destructive mr-auto min-w-0 font-medium"
        >
          {error}
        </p>
      )}
      {children}
      {/* The shared Button, not a hand-typed copy of its default variant —
          this is the save button on every editor in the app. */}
      <Button onClick={onSave} disabled={saving || disabled}>
        {saving ? savingLabel : saveLabel}
      </Button>
    </div>
  );
}

/** The outer wrapper for an editor page: header + sections + save bar. */
export function EditorForm({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid max-w-4xl gap-4", className)}>{children}</div>
  );
}
