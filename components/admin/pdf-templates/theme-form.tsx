"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FIELD_LABEL_ROW,
  FormField,
  FormGrid,
  FormSection,
} from "@/components/admin/ui/form-shell";
import { SelectField } from "@/components/admin/ui/select-field";
import type { Theme } from "@/lib/schemas/pdf-template";
import { NumberField } from "./fields";

const COLOURS: { key: keyof Theme["colors"]; label: string; hint: string }[] = [
  {
    key: "accent",
    label: "Accent",
    hint: "Bars, rules, footer band, watermark.",
  },
  { key: "ink", label: "Text", hint: "Body text." },
  { key: "muted", label: "Muted text", hint: "Footnotes." },
  {
    key: "rule",
    label: "Table rule",
    hint: "Around the table and under its head.",
  },
  { key: "hairline", label: "Hairline", hint: "Between cells." },
  {
    key: "tint",
    label: "Header wash",
    hint: "Behind table headings and totals.",
  },
];

/** A colour swatch paired with its hex, both editing the same value. */
function ColourField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid content-start gap-1.5">
      <div className={FIELD_LABEL_ROW}>
        <Label htmlFor={id}>{label}</Label>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} swatch`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border-input dark:bg-input/30 size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5 shadow-xs"
        />
        <Input
          id={id}
          value={value}
          maxLength={7}
          spellCheck={false}
          className="font-mono"
          onChange={(e) => {
            const v = e.target.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v.toLowerCase());
            else if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
        />
      </div>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}

export function ThemeForm({
  theme,
  onChange,
}: {
  theme: Theme;
  onChange: (t: Theme) => void;
}) {
  return (
    <div className="grid gap-4">
      <FormSection title="Colours">
        <FormGrid>
          {COLOURS.map((c) => (
            <ColourField
              key={c.key}
              label={c.label}
              hint={c.hint}
              value={theme.colors[c.key]}
              onChange={(v) =>
                onChange({ ...theme, colors: { ...theme.colors, [c.key]: v } })
              }
            />
          ))}
        </FormGrid>
      </FormSection>

      <FormSection title="Type">
        <FormGrid cols={3}>
          <FormField label="Body face">
            <SelectField
              value={theme.font.body}
              onChange={(v) =>
                onChange({
                  ...theme,
                  font: { ...theme.font, body: v as Theme["font"]["body"] },
                })
              }
              options={[
                { value: "Times", label: "Times" },
                { value: "Helvetica", label: "Helvetica" },
              ]}
            />
          </FormField>
          <NumberField
            label="Body size (pt)"
            value={theme.font.size}
            onChange={(size) =>
              onChange({ ...theme, font: { ...theme.font, size: size ?? 8 } })
            }
            min={8}
            max={14}
            step={0.5}
          />
          <NumberField
            label="Table size (pt)"
            value={theme.font.tableSize}
            onChange={(tableSize) =>
              onChange({
                ...theme,
                font: { ...theme.font, tableSize: tableSize ?? 7 },
              })
            }
            min={7}
            max={13}
            step={0.5}
          />
        </FormGrid>
      </FormSection>

      <FormSection
        title="Page margins"
        description="Points; A4 is 595 × 842. The letterhead bleeds past these on purpose."
      >
        <FormGrid cols={3}>
          <NumberField
            label="Sides"
            value={theme.page.padX}
            onChange={(padX) =>
              onChange({ ...theme, page: { ...theme.page, padX: padX ?? 20 } })
            }
            min={20}
            max={80}
          />
          <NumberField
            label="Top"
            value={theme.page.padTop}
            onChange={(padTop) =>
              onChange({
                ...theme,
                page: { ...theme.page, padTop: padTop ?? 10 },
              })
            }
            min={10}
            max={80}
          />
          <NumberField
            label="Bottom"
            value={theme.page.padBottom}
            onChange={(padBottom) =>
              onChange({
                ...theme,
                page: { ...theme.page, padBottom: padBottom ?? 30 },
              })
            }
            min={30}
            max={120}
            hint="Leave room for the footer band."
          />
        </FormGrid>
      </FormSection>
    </div>
  );
}
