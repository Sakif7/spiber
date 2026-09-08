"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * The two switch shapes the admin uses, in one place.
 *
 * Both were hand-rolled at five call sites — the locale switcher, the blog
 * body tabs, the Operations/Company switcher, the list status filter and the
 * blog tag picker — and had drifted into three different looks. They are
 * toggle groups rather than Radix `Tabs` on purpose: none of them owns a set
 * of tab panels (the locale switch changes one input's value, and the section
 * switcher navigates), which is the same call made for the contact-page
 * location switcher.
 */

export type SegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  /** Shows a filled dot after the label — which locales already have content. */
  dot?: boolean;
};

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "sm",
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  /** Names the group for assistive tech. */
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "bg-muted inline-flex shrink-0 items-center gap-0.5 rounded-md p-0.5",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "focus-visible:ring-ring/50 flex items-center gap-1 rounded font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px]",
              size === "sm"
                ? "text-admin-2xs px-2 py-0.5"
                : "text-admin-xs px-2.5 py-1",
              active
                ? "bg-card text-foreground border shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            {o.dot !== undefined && (
              <span
                aria-hidden
                className={cn(
                  "size-1 rounded-full",
                  o.dot ? "bg-[var(--tone-success-fg)]" : "bg-transparent",
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** A standalone on/off pill — status filters, tag pickers. */
export function TogglePill({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "text-admin-xs focus-visible:ring-ring/50 rounded-full border px-2.5 py-1 font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px]",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
