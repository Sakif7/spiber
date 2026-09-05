"use client";

import { useId, useState } from "react";
import { routing } from "@/i18n/routing";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

/** Partial localized value while editing (English is the only required one). */
export type LocalizedValue = { en?: string; bn?: string; ja?: string };

/** Tab caption per locale. */
const LOCALE_LABEL: Record<string, string> = {
  en: "EN",
  bn: "বাংলা",
  ja: "日本語",
};

/**
 * Shared admin editor for a localized `{ en, bn, ja }` content field.
 *
 * One field at a time behind a compact locale tab strip, driven by
 * `routing.locales`, so adding a UI language adds its tab everywhere. Stacking
 * one input per locale tripled the height of every content form (and sextupled
 * a specs row); tabs keep a form readable while the filled dot on each tab
 * still shows at a glance which translations exist. English is the required
 * fallback; the others are optional.
 */
export function LocalizedInput({
  label,
  ariaLabel,
  value,
  onChange,
  textarea,
  rows = 3,
  required,
  placeholder,
  hint,
  className,
  onPasteEn,
}: {
  label?: string;
  /**
   * Accessible name when there is no visible label — repeated rows (spec 2,
   * option 3…) show the label only on the first row, so without this every
   * other field would be announced as just "EN".
   */
  ariaLabel?: string;
  value: LocalizedValue;
  onChange: (v: LocalizedValue) => void;
  textarea?: boolean;
  rows?: number;
  required?: boolean;
  /** Shown in the English field; other locales fall back to the tab caption. */
  placeholder?: string;
  hint?: string;
  className?: string;
  /**
   * Paste handler for the ENGLISH field only — lets a caller intercept a
   * structured paste (the specs editor splits a "Key: Value" block into rows)
   * without hijacking paste in the translation tabs.
   */
  onPasteEn?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}) {
  const [active, setActive] = useState<string>(routing.locales[0]);
  const id = useId();
  const locales = routing.locales as readonly string[];
  const caption = LOCALE_LABEL[active] ?? active.toUpperCase();
  const name = label ?? ariaLabel;
  const aria = name ? `${name} (${caption})` : caption;
  const common = {
    id,
    value: value[active as keyof LocalizedValue] ?? "",
    "aria-label": aria,
    placeholder:
      active === "en" ? (placeholder ?? caption) : `${caption} translation`,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...value, [active]: e.target.value }),
  };

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {label ? (
          <Label htmlFor={id}>
            {label}
            {required && <span className="text-destructive"> *</span>}
          </Label>
        ) : (
          <span />
        )}
        <div
          role="group"
          aria-label={name ? `${name} language` : "Language"}
          className="bg-muted inline-flex items-center gap-0.5 rounded-md p-0.5"
        >
          {locales.map((l) => {
            const filled = Boolean(
              (value[l as keyof LocalizedValue] ?? "").trim(),
            );
            const isActive = l === active;
            return (
              <button
                key={l}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActive(l)}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                  isActive
                    ? "bg-card text-foreground shadow-[var(--shadow-sm)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {LOCALE_LABEL[l] ?? l.toUpperCase()}
                <span
                  aria-hidden
                  className={cn(
                    "size-1 rounded-full",
                    filled ? "bg-[var(--color-success)]" : "bg-transparent",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
      {textarea ? (
        <Textarea rows={rows} {...common} />
      ) : (
        <Input {...common} onPaste={active === "en" ? onPasteEn : undefined} />
      )}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
