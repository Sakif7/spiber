import { cn } from "@/lib/cn";

export type Tone =
  | "success"
  | "warning"
  | "info"
  | "neutral"
  | "danger"
  | "brand";

const TONE_VAR: Record<Tone, string> = {
  success: "--color-success",
  warning: "--color-warning",
  info: "--color-info",
  danger: "--color-error",
  brand: "--color-brand",
  neutral: "--color-text-muted",
};

/**
 * Map a free-form status string (orders, cases, enrollments, etc.) to a tone.
 * Falls back to neutral. Matching is case-insensitive on a normalised key.
 */
export function statusTone(status: string): Tone {
  const s = status.toLowerCase().replace(/[\s-]+/g, "_");
  if (
    [
      "active",
      "paid",
      "confirmed",
      "completed",
      "approved",
      "won",
      "published",
      "delivered",
      "shipped",
      "fulfilled",
      "issued",
      "live",
    ].includes(s)
  )
    return "success";
  if (
    [
      "pending",
      "new",
      "processing",
      "awaiting",
      "awaiting_payment",
      "scheduled",
      "on_hold",
    ].includes(s)
  )
    return "warning";
  if (
    [
      "reviewing",
      "qualifying",
      "arranging",
      "in_treatment",
      "negotiating",
      "quoted",
      "proposal",
      "follow_up",
      "provisioning",
    ].includes(s)
  )
    return "info";
  if (
    [
      "cancelled",
      "canceled",
      "refunded",
      "lost",
      "rejected",
      "failed",
      "void",
      "expired",
      "disabled",
    ].includes(s)
  )
    return "danger";
  return "neutral"; // draft, closed, archived, unknown
}

/** Soft, theme-aware status pill. */
export function StatusBadge({
  children,
  tone,
  dot = true,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  const resolved: Tone =
    tone ?? statusTone(typeof children === "string" ? children : "neutral");
  const v = `var(${TONE_VAR[resolved]})`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap capitalize",
        className,
      )}
      style={{
        color: v,
        backgroundColor: `color-mix(in srgb, ${v} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${v} 28%, transparent)`,
      }}
    >
      {dot && (
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ backgroundColor: v }}
        />
      )}
      {typeof children === "string" ? children.replace(/_/g, " ") : children}
    </span>
  );
}
