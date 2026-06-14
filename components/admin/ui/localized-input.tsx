"use client";

import { routing } from "@/i18n/routing";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/** Partial localized value while editing (English is the only required one). */
export type LocalizedValue = { en?: string; bn?: string; ja?: string };

/** Per-locale placeholder shown in each field. */
const LOCALE_LABEL: Record<string, string> = {
  en: "EN",
  bn: "বাংলা",
  ja: "日本語",
};

/**
 * Shared admin editor for a localized `{ en, bn, ja }` content field — one input
 * (or textarea) per supported locale, driven by `routing.locales`, so adding a
 * new UI language automatically adds its field everywhere. English is the
 * required fallback; the others are optional. Replaces the per-form
 * `BilingualField`/`LocalizedField` helpers and hand-rolled EN | বাংলা pairs.
 */
export function LocalizedInput({
  label,
  value,
  onChange,
  textarea,
  rows = 3,
  required,
}: {
  label?: string;
  value: LocalizedValue;
  onChange: (v: LocalizedValue) => void;
  textarea?: boolean;
  rows?: number;
  required?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      {label && (
        <Label>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
      )}
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: textarea
            ? "1fr"
            : "repeat(auto-fit, minmax(160px, 1fr))",
        }}
      >
        {routing.locales.map((l) => {
          const ph = LOCALE_LABEL[l] ?? l.toUpperCase();
          const aria = label ? `${label} (${ph})` : ph;
          return textarea ? (
            <Textarea
              key={l}
              placeholder={ph}
              aria-label={aria}
              rows={rows}
              value={value[l] ?? ""}
              onChange={(e) => onChange({ ...value, [l]: e.target.value })}
            />
          ) : (
            <Input
              key={l}
              placeholder={ph}
              aria-label={aria}
              value={value[l] ?? ""}
              onChange={(e) => onChange({ ...value, [l]: e.target.value })}
            />
          );
        })}
      </div>
    </div>
  );
}
