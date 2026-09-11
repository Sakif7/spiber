"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/admin/ui/form-shell";
import { SelectField } from "@/components/admin/ui/select-field";
import { DATA_PATHS, type PathKind } from "@/lib/pdf/engine/paths";
import type { TemplateKind } from "@/lib/schemas/pdf-template";

/** A numeric prop (points, weights, opacity). Empty clears an optional one. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  optional,
  hint,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  optional?: boolean;
  hint?: React.ReactNode;
}) {
  return (
    <FormField label={label} hint={hint}>
      <Input
        type="number"
        inputMode="decimal"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        placeholder={optional ? "—" : undefined}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(optional ? undefined : (min ?? 0));
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </FormField>
  );
}

/** A labelled on/off, laid out like the rest of the admin's switches. */
export function SwitchField({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="grid content-start gap-1.5">
      <div className="flex min-h-6 items-center gap-2">
        <Switch id={id} checked={checked} onCheckedChange={onChange} />
        <Label htmlFor={id}>{label}</Label>
      </div>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

/**
 * Pick one of the document's data paths — for a totals figure or a
 * show-when condition. Limited to the kinds that make sense there.
 */
export function PathSelect({
  label,
  value,
  onChange,
  kind,
  kinds,
  emptyLabel,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  kind: TemplateKind;
  kinds?: PathKind[];
  emptyLabel?: string;
  hint?: React.ReactNode;
}) {
  const options = DATA_PATHS[kind]
    .filter((d) => !kinds || kinds.includes(d.kind))
    .map((d) => ({ value: d.path, label: `${d.label} — ${d.path}` }));
  // A value the picker does not list (typed into the JSON by hand) is still
  // shown rather than silently replaced.
  if (value && !options.some((o) => o.value === value)) {
    options.unshift({ value, label: value });
  }
  return (
    <FormField label={label} hint={hint}>
      <SelectField
        value={value}
        onChange={onChange}
        options={options}
        emptyLabel={emptyLabel}
        placeholder="Choose a field…"
      />
    </FormField>
  );
}

/** `showIf` as a picker plus an "invert" switch. */
export function ConditionField({
  value,
  onChange,
  kind,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  kind: TemplateKind;
}) {
  const negated = value?.startsWith("!") ?? false;
  const path = value ? value.replace(/^!/, "") : "";
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <PathSelect
        label="Show only when this field has a value"
        value={path}
        onChange={(p) => onChange(p ? `${negated ? "!" : ""}${p}` : undefined)}
        kind={kind}
        emptyLabel="Always shown"
      />
      <SwitchField
        label="Invert"
        checked={negated}
        onChange={(v) => onChange(path ? `${v ? "!" : ""}${path}` : undefined)}
        hint="Show when the field is empty instead."
      />
    </div>
  );
}
