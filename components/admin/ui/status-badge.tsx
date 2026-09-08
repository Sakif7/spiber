import { cn } from "@/lib/cn";
import { TONE_DOT, TONE_EDGE, TONE_FILL, TONE_TEXT } from "./tone";

export type Tone =
  | "success"
  | "warning"
  | "info"
  | "neutral"
  | "danger"
  | "brand";

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
  return (
    <span
      className={cn(
        "text-admin-xs inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium whitespace-nowrap capitalize",
        TONE_TEXT[resolved],
        TONE_FILL[resolved],
        TONE_EDGE[resolved],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", TONE_DOT[resolved])}
        />
      )}
      {typeof children === "string" ? children.replace(/_/g, "") : children}
    </span>
  );
}
