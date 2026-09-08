"use client";

import { useId, useState } from "react";
import { routing } from "@/i18n/routing";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FIELD_LABEL_ROW } from "@/components/admin/ui/form-shell";
import { Segmented } from "@/components/admin/ui/segmented";
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
   * other field would be announced as just"EN".
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
   * structured paste (the specs editor splits a"Key: Value" block into rows)
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
    // `content-start` so this never stretches to fill a taller grid cell, and
    // the shared label-row height so the control below sits on the same
    // baseline as a plain FormField beside it.
    <div className={cn("grid content-start gap-1.5", className)}>
      <div className={cn(FIELD_LABEL_ROW, "justify-between")}>
        {label ? (
          <Label htmlFor={id}>
            {label}
            {required && <span className="text-destructive"> *</span>}
          </Label>
        ) : (
          <span />
        )}
        <Segmented
          value={active}
          onChange={setActive}
          label={name ? `${name} language` : "Language"}
          options={locales.map((l) => ({
            value: l,
            label: LOCALE_LABEL[l] ?? l.toUpperCase(),
            dot: Boolean((value[l as keyof LocalizedValue] ?? "").trim()),
          }))}
        />
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
