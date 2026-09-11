"use client";

import { useId, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/admin/ui/form-shell";
import { SelectField } from "@/components/admin/ui/select-field";
import { DATA_PATHS, placeholdersIn } from "@/lib/pdf/engine/paths";
import type { TemplateKind } from "@/lib/schemas/pdf-template";

/**
 * A text prop of a block: typed freely, with a picker that drops a
 * `{{field}}` in at the caret, and a warning under it for any field the
 * document does not carry (which would print as nothing).
 */
export function TemplateText({
  label,
  value,
  onChange,
  kind,
  multiline,
  rows = 3,
  hint,
  placeholder,
  required,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  kind: TemplateKind;
  multiline?: boolean;
  rows?: number;
  hint?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const offered = DATA_PATHS[kind];
  const unknown = placeholdersIn(value).filter(
    (p) => !offered.some((d) => d.path === p),
  );

  function insert(path: string) {
    const el = ref.current;
    const token = `{{${path}}}`;
    if (!el) {
      onChange(value + token);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    onChange(value.slice(0, start) + token + value.slice(end));
    // Put the caret after what was inserted once React has re-rendered.
    requestAnimationFrame(() => {
      el.focus();
      const at = start + token.length;
      el.setSelectionRange(at, at);
    });
  }

  const warning =
    unknown.length > 0 ? (
      <span className="text-[var(--tone-warning-fg)]">
        Unknown field{unknown.length > 1 ? "s" : ""}:{" "}
        {unknown.map((p) => `{{${p}}}`).join(", ")} — will print as nothing.
      </span>
    ) : null;

  return (
    <FormField
      label={label}
      htmlFor={id}
      required={required}
      hint={
        warning || hint ? (
          <>
            {warning}
            {warning && hint ? " " : null}
            {hint}
          </>
        ) : undefined
      }
    >
      <div className="grid gap-1.5">
        {multiline ? (
          <Textarea
            id={id}
            ref={ref as React.RefObject<HTMLTextAreaElement>}
            value={value}
            rows={rows}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <Input
            id={id}
            ref={ref as React.RefObject<HTMLInputElement>}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        <SelectField
          value=""
          onChange={(p) => p && insert(p)}
          placeholder="Insert a field…"
          ariaLabel={`Insert a field into ${label ?? "the text"}`}
          options={offered.map((d) => ({
            value: d.path,
            label: `${d.label} — {{${d.path}}}`,
          }))}
          className="text-muted-foreground h-8 text-xs"
        />
      </div>
    </FormField>
  );
}
