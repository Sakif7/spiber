import type { DocumentLine } from "@/lib/pdf/types";

/**
 * Equipment orders: the same pipeline as consumables, different paper.
 *
 * A consumables order is a table of lines on a quotation. A high-value
 * machine is sold on a price offer — ONE machine, its accessories numbered
 * beneath it, one price for the set spelled out in words, the manufacturer
 * in the terms — so the documents read differently while the order behind
 * them (lines, stock, VAT, AIT, numbering) is exactly the same thing.
 *
 * Accessories are ordinary order LINES carrying `role: "accessory"`, not a
 * nested array: they may come from the catalogue, and that way every bit of
 * reservation, costing and delivery machinery already works on them.
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
 * What a line is on an equipment order.
 *
 * Absent on every consumables line, and on equipment orders raised before
 * accessories existed — which are the machine, so read it through
 * `isAccessory` rather than comparing to `"machine"`.
 */
export type LineRole = "machine" | "accessory";

export type RoledLine = { role?: LineRole | null };

export const isAccessory = (l: RoledLine): boolean => l.role === "accessory";

/** The machine an equipment order is for: the one line that is not an accessory. */
export function machineOf<T extends RoledLine>(items: T[]): T | undefined {
  return items.find((i) => !isAccessory(i));
}

export function accessoriesOf<T extends RoledLine>(items: T[]): T[] {
  return items.filter(isAccessory);
}

/** Every line that is not an accessory — more than one is refused on an equipment order. */
export function machineLinesOf<T extends RoledLine>(items: T[]): T[] {
  return items.filter((i) => !isAccessory(i));
}

/**
 * The terms an equipment quotation carries.
 *
 * The six numbered ones are free text because every one is negotiated: a
 * second year of warranty, a 50% advance, delivery after a letter of credit.
 * `deliveryScope` is not one of them — it is the short note printed beside
 * the price above the table ("Delivery: Local Delivery").
 */
export type EquipmentTerms = {
  payment: string;
  installation: string;
  warranty: string;
  afterWarranty: string;
  delivery: string;
  training: string;
  deliveryScope: string;
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
  deliveryScope: "Local Delivery",
};

/** The six numbered terms, labelled as they print, in the order they print. */
export const EQUIPMENT_TERM_FIELDS: {
  key: Exclude<keyof EquipmentTerms, "deliveryScope">;
  label: string;
}[] = [
  { key: "payment", label: "Payment Terms" },
  { key: "installation", label: "Installation & Commissioning" },
  { key: "warranty", label: "Warranty" },
  { key: "afterWarranty", label: "After Warranty Period" },
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
  for (const key of Object.keys(
    EQUIPMENT_TERM_DEFAULTS,
  ) as (keyof EquipmentTerms)[]) {
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

/** "Colour Doppler Ultrasound System (Model Vivid E95)" — the machine, named. */
export function equipmentName(l: EquipmentLike): string {
  const name = clean(l.description);
  const model = clean(l.model);
  return model ? `${name} (Model ${model})` : name;
}

/**
 * The machines the document is about, as they read in a sentence. One
 * machine is the usual case; the plural form survives for an order raised
 * before the one-machine rule.
 */
export function equipmentSummary(lines: EquipmentLike[]): string {
  return joinNaturally(
    lines.map((l) =>
      l.qty > 1 ? `${l.qty} × ${equipmentName(l)}` : equipmentName(l),
    ),
  );
}

/** "one set of X", "2 sets of X" — the opening sentence's object. */
export function equipmentSetPhrase(lines: EquipmentLike[]): string {
  const name = equipmentSummary(lines);
  if (!name) return "";
  const qty = lines.length === 1 ? lines[0].qty : 0;
  if (qty === 1) return `one set of ${name}`;
  if (qty > 1) return `${qty} sets of ${clean(lines[0].description)}`;
  return name;
}

/** "GE HealthCare, USA" — who makes it and where, once per maker. */
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

/** "1 set", "4 pcs" — an accessory's quantity as the table prints it. */
export function accessoryQtyLabel(a: {
  qty: number;
  unit?: string | null;
}): string {
  const unit = clean(a.unit) || "set";
  return `${a.qty} ${unit}`;
}

/**
 * An equipment line as the ruled tables print it — the challan, or a line
 * table a super-admin adds to an equipment template.
 *
 * The model and, when asked for, the serial number go into the specification
 * cell rather than columns of their own: the challan's built-in layout is
 * shared with consumables orders and must not grow a column that is blank on
 * every one of those. An accessory prints plainly — it has no model of its
 * own, and its name is what was delivered.
 */
export function equipmentPrintedColumns(
  l: EquipmentLike & RoledLine,
  opts: { serial?: boolean } = {},
): Pick<DocumentLine, "description" | "brandOrigin" | "specification"> {
  if (isAccessory(l)) {
    return {
      description: clean(l.description),
      brandOrigin: clean(l.manufacturer) || null,
      specification: clean(l.specification) || null,
    };
  }
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
