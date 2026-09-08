"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";

export type SelectOption = { value: string; label: string };

/** Radix cannot hold an empty-string item value, so"no choice" gets a token. */
const NONE = "__none";

/**
 * A shadcn Select with the ergonomics of the native `<select>` the admin forms
 * used to hand-style: an options array, a string value, and an `onChange` that
 * hands back the value. `emptyLabel` adds a leading"none" choice that maps to
 * `""`, matching the `<option value="">— none —</option>` idiom it replaces.
 */
export function SelectField({
  value,
  onChange,
  options,
  emptyLabel,
  placeholder,
  id,
  ariaLabel,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  emptyLabel?: string;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={value === "" ? (emptyLabel ? NONE : "") : value}
      onValueChange={(v) => onChange(v === NONE ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn("w-full", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {emptyLabel && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
