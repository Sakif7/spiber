import type { DocumentLine } from "@/lib/pdf/types";

/**
 * Equipment orders: the same pipeline as consumables, different paper.
 *
 * A consumables order is a table of lines on a quotation. A high-value
 * machine is sold on a letter — the equipment is named in the opening
 * paragraph, the manufacturer sits in the terms, and the price is one figure
 * spelled out in words — so the documents read differently while the order
 * behind them (lines, stock, VAT, AIT, numbering) is exactly the same thing.
 *
 * Client-safe: the order editor and the proposal dialog import this, so it
 * must never touch a model.
 */

export type SalesOrderKind = "consumables" | "equipment";

export const SALES_ORDER_KIND_LABEL: Record<SalesOrderKind, string> = {
  consumables: "Consumables",
  equipment: "Equipment",
};

/** Orders raised before the kind existed are consumables: that is all there was. */
export function orderKindOf(o: {
  kind?: SalesOrderKind | null;
}): SalesOrderKind {
  return o.kind ?? "consumables";
}

/**
 * The terms an equipment quotation carries, one line each.
 *
 * Every one is free text because every one is negotiated: a second year of
 * warranty, a 50% advance, delivery after a letter of credit. These are the
 * defaults the dialog opens with, worded as the company's own letter is.
 */
export type EquipmentTerms = {
  payment: string;
  installation: string;
  warranty: string;
  afterWarranty: string;
  delivery: string;
  training: string;
};

export const EQUIPMENT_TERM_DEFAULTS: EquipmentTerms = {
  payment: "100% advance payment.",
  installation:
    "The equipment will be installed and commissioned at your premises by our foreign-trained biomedical engineers, free of charge.",
  warranty: "One year's full warranty from the date of installation.",
  afterWarranty:
    "Service is available under an Annual Maintenance Contract (AMC) once the warranty period ends.",
  delivery: "Within 3 business days of receiving the advance payment.",
  training:
    "User training will be provided at your premises by our foreign-trained biomedical engineers, free of charge.",
};

/** The dialog's fields, in the order they print. */
export const EQUIPMENT_TERM_FIELDS: {
  key: keyof EquipmentTerms;
  label: string;
}[] = [
  { key: "payment", label: "Payment" },
  { key: "installation", label: "Installation and commissioning" },
  { key: "warranty", label: "Warranty" },
  { key: "afterWarranty", label: "After the warranty period" },
  { key: "delivery", label: "Delivery" },
  { key: "training", label: "Training" },
];

/** Fill in whatever the caller left blank, so a stored set is always complete. */
export function completeEquipmentTerms(
  input?: Partial<
    Record<keyof EquipmentTerms, string | null | undefined>
  > | null,
): EquipmentTerms {
  const out = { ...EQUIPMENT_TERM_DEFAULTS };
  for (const { key } of EQUIPMENT_TERM_FIELDS) {
    const v = input?.[key]?.trim();
    if (v) out[key] = v;
  }
  return out;
}

/** What an equipment line says about the machine. */
export type EquipmentLike = {
  description: string;
  model?: string | null;
  manufacturer?: string | null;
  origin?: string | null;
  specification?: string | null;
  serialNo?: string | null;
  qty: number;
};

const clean = (s: string | null | undefined) => (s ?? "").trim();

/** "A, B and C" — the way a sentence lists things. */
export function joinNaturally(parts: string[]): string {
  const p = parts.filter(Boolean);
  if (p.length <= 1) return p[0] ?? "";
  return `${p.slice(0, -1).join(", ")} and ${p[p.length - 1]}`;
}

/** "Vivid E95 Ultrasound System (Model Vivid E95)" — one machine as the letter names it. */
export function equipmentName(l: EquipmentLike): string {
  const name = clean(l.description);
  const model = clean(l.model);
  return model ? `${name} (Model ${model})` : name;
}

/**
 * The machines the document is about, as they read in a sentence: "2 × X
 * (Model M) and Y". A quantity of one is left unsaid, as it would be in a
 * letter.
 */
export function equipmentSummary(lines: EquipmentLike[]): string {
  return joinNaturally(
    lines.map((l) =>
      l.qty > 1 ? `${l.qty} × ${equipmentName(l)}` : equipmentName(l),
    ),
  );
}

/** "GE Healthcare, USA" — who makes it and where, once per maker. */
export function equipmentManufacturers(lines: EquipmentLike[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    const text = [clean(l.manufacturer), clean(l.origin)]
      .filter(Boolean)
      .join(", ");
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
  }
  return out.join("; ");
}

/** Every specification given, one per machine when there are several. */
export function equipmentSpecification(lines: EquipmentLike[]): string {
  const specs = lines
    .map((l) => ({ name: equipmentName(l), spec: clean(l.specification) }))
    .filter((s) => s.spec);
  if (specs.length === 0) return "";
  if (specs.length === 1) return specs[0].spec;
  return specs.map((s) => `${s.name}: ${s.spec}`).join(" · ");
}

/**
 * An equipment line as the ruled tables print it — the challan, or a line
 * table a super-admin adds to an equipment template.
 *
 * The model and, when asked for, the serial number go into the specification
 * cell rather than columns of their own: the challan's built-in layout is
 * shared with consumables orders and must not grow a column that is blank on
 * every one of those.
 */
export function equipmentPrintedColumns(
  l: EquipmentLike,
  opts: { serial?: boolean } = {},
): Pick<DocumentLine, "description" | "brandOrigin" | "specification"> {
  const parts: string[] = [];
  if (clean(l.model)) parts.push(`Model: ${clean(l.model)}`);
  if (opts.serial && clean(l.serialNo))
    parts.push(`Serial no: ${clean(l.serialNo)}`);
  if (clean(l.specification)) parts.push(clean(l.specification));
  return {
    description: clean(l.description),
    brandOrigin:
      [clean(l.manufacturer), clean(l.origin)].filter(Boolean).join(" / ") ||
      null,
    specification: parts.join(" · ") || null,
  };
}
