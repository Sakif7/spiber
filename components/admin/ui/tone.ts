import { cn } from "@/lib/cn";
import type { Tone } from "./status-badge";

/**
 * Tailwind classes per status tone, driven by the `--tone-*` tokens defined on
 * `.admin-root`.
 *
 * The class strings are static because Tailwind cannot see a class name built
 * at runtime. The alternative — an inline `color-mix()` per element, which is
 * what StatusBadge and StatCard each did separately — put two copies of the
 * palette in TSX, kept them off the token layer, and shipped a label colour
 * that failed AA in light mode at every tone.
 */
export const TONE_TEXT: Record<Tone, string> = {
  success: "text-[var(--tone-success-fg)]",
  warning: "text-[var(--tone-warning-fg)]",
  danger: "text-[var(--tone-danger-fg)]",
  info: "text-[var(--tone-info-fg)]",
  brand: "text-[var(--tone-brand-fg)]",
  neutral: "text-[var(--tone-neutral-fg)]",
};

/** Soft tint behind the label — an alpha fill, so it works over any surface. */
export const TONE_FILL: Record<Tone, string> = {
  success:
    "bg-[color-mix(in_srgb,var(--tone-success)_var(--tone-fill),transparent)]",
  warning:
    "bg-[color-mix(in_srgb,var(--tone-warning)_var(--tone-fill),transparent)]",
  danger:
    "bg-[color-mix(in_srgb,var(--tone-danger)_var(--tone-fill),transparent)]",
  info: "bg-[color-mix(in_srgb,var(--tone-info)_var(--tone-fill),transparent)]",
  brand:
    "bg-[color-mix(in_srgb,var(--tone-brand)_var(--tone-fill),transparent)]",
  neutral:
    "bg-[color-mix(in_srgb,var(--tone-neutral)_var(--tone-fill),transparent)]",
};

export const TONE_EDGE: Record<Tone, string> = {
  success:
    "border-[color-mix(in_srgb,var(--tone-success)_var(--tone-edge),transparent)]",
  warning:
    "border-[color-mix(in_srgb,var(--tone-warning)_var(--tone-edge),transparent)]",
  danger:
    "border-[color-mix(in_srgb,var(--tone-danger)_var(--tone-edge),transparent)]",
  info: "border-[color-mix(in_srgb,var(--tone-info)_var(--tone-edge),transparent)]",
  brand:
    "border-[color-mix(in_srgb,var(--tone-brand)_var(--tone-edge),transparent)]",
  neutral:
    "border-[color-mix(in_srgb,var(--tone-neutral)_var(--tone-edge),transparent)]",
};

/** The dot and icon glyphs take the same accessible value as the label. */
export const TONE_DOT: Record<Tone, string> = {
  success: "bg-[var(--tone-success-fg)]",
  warning: "bg-[var(--tone-warning-fg)]",
  danger: "bg-[var(--tone-danger-fg)]",
  info: "bg-[var(--tone-info-fg)]",
  brand: "bg-[var(--tone-brand-fg)]",
  neutral: "bg-[var(--tone-neutral-fg)]",
};

/**
 * The box styling for an inline callout — a tinted panel that flags a caveat
 * without shouting. The body text stays in the normal foreground colour, so
 * only the frame carries the tone.
 *
 * Extracted because the seller-managed warning was written out three times,
 * byte for byte, in the two inventory drawers and the CSV dialog.
 */
export function calloutClass(tone: Tone, className?: string) {
  return cn(
    "rounded-lg border px-3 py-2.5",
    TONE_FILL[tone],
    TONE_EDGE[tone],
    className,
  );
}
