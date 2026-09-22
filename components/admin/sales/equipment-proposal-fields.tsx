"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EQUIPMENT_TERM_FIELDS,
  EQUIPMENT_TERM_DEFAULTS,
  type EquipmentTerms,
} from "@/lib/sales/equipment";

/** What the equipment letter asks for before it is produced. */
export type EquipmentProposalDraft = {
  subject: string;
  /** Blank prints the template's standard opening, which names the machines. */
  intro: string;
  terms: EquipmentTerms;
};

export function equipmentProposalDraft(
  subject: string,
  terms?: EquipmentTerms | null,
): EquipmentProposalDraft {
  return {
    subject,
    intro: "",
    terms: { ...EQUIPMENT_TERM_DEFAULTS, ...(terms ?? {}) },
  };
}

/**
 * The fields of an equipment quotation: the subject line, an optional
 * opening paragraph, and the six numbered terms.
 *
 * Every term opens with the standard wording so the usual letter is one
 * click, and each is a plain box because each is negotiated per deal — a
 * second year of warranty, a 50% advance, delivery after a letter of credit.
 * Shared by the new-order editor and the order's own Generate dialog, so the
 * two never drift apart.
 */
export function EquipmentProposalFields({
  value,
  onChange,
  idPrefix = "eq",
}: {
  value: EquipmentProposalDraft;
  onChange: (next: EquipmentProposalDraft) => void;
  idPrefix?: string;
}) {
  const setTerm = (key: keyof EquipmentTerms, text: string) =>
    onChange({ ...value, terms: { ...value.terms, [key]: text } });

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-subject`}>Subject</Label>
        <Input
          id={`${idPrefix}-subject`}
          value={value.subject}
          onChange={(e) => onChange({ ...value, subject: e.target.value })}
          maxLength={200}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-intro`}>Opening paragraph</Label>
        <Textarea
          id={`${idPrefix}-intro`}
          value={value.intro}
          onChange={(e) => onChange({ ...value, intro: e.target.value })}
          rows={3}
          placeholder="Leave blank for the standard opening, which names the equipment and quotes the price."
          maxLength={1500}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-deliveryScope`}>Delivery</Label>
        <Input
          id={`${idPrefix}-deliveryScope`}
          value={value.terms.deliveryScope}
          onChange={(e) => setTerm("deliveryScope", e.target.value)}
          maxLength={80}
          placeholder={EQUIPMENT_TERM_DEFAULTS.deliveryScope}
        />
        <p className="text-muted-foreground text-xs">
          Printed beside the price, above the table.
        </p>
      </div>
      <fieldset className="grid gap-2 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">
          Terms and conditions
        </legend>
        <p className="text-muted-foreground text-xs">
          Printed as a numbered list, in this order, with the manufacturer last
          — it comes from the equipment&rsquo;s own Manufacturer field. Blank
          means the standard wording.
        </p>
        {EQUIPMENT_TERM_FIELDS.map((f, i) => (
          <div key={f.key} className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-${f.key}`}>
              {i + 1}. {f.label}
            </Label>
            <Textarea
              id={`${idPrefix}-${f.key}`}
              value={value.terms[f.key]}
              onChange={(e) => setTerm(f.key, e.target.value)}
              rows={2}
              maxLength={300}
              placeholder={EQUIPMENT_TERM_DEFAULTS[f.key]}
            />
          </div>
        ))}
      </fieldset>
    </div>
  );
}
