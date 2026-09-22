import type { LineRole, SalesOrderKind } from "@/lib/sales/equipment";

/**
 * A line as the order editor holds it: everything as typed, prices in taka.
 *
 * Shared by the consumables table and the equipment editor so the payload
 * both of them build is the same shape — the two surfaces show different
 * fields of the same line, not two different kinds of line.
 */
export type EditorLine = {
  id?: string;
  kind: "inventory" | "external";
  /** Equipment orders: the machine, or an accessory listed under it. */
  role?: LineRole;
  productId?: string | null;
  variantId?: string | null;
  sku?: string | null;
  description: string;
  brandOrigin: string;
  specification: string;
  /** Equipment lines: shown instead of Brand/Origin and Unit. */
  model: string;
  manufacturer: string;
  origin: string;
  /** Known once the machine is on the floor; printed on the challan only. */
  serialNo: string;
  unit: string;
  /** Taka, as typed. */
  unitPrice: string;
  /**
   * What the line costs US, in taka as typed.
   *
   * Prefilled from the catalogue when a product is picked, and free to type on
   * an external item that was bought in for this order. Always editable: the
   * price actually paid to a supplier is not always the price on the product.
   */
  unitCost: string;
  /**
   * VAT for this line, as typed — a percentage or a taka figure, per
   * `vatMode`. Blank means "not set on this line".
   *
   * Setting it on ANY line takes the whole order out of the configured rate
   * and onto per-line VAT, at which point a blank line carries none. The
   * editor says so where it can be read.
   */
  vatValue: string;
  vatMode: "percent" | "amount";
  qty: string;
  /** What inventory says is still available, for a visible warning. */
  available?: number | null;
};

export const toMinor = (taka: string) => Math.round((Number(taka) || 0) * 100);
export const fromMinor = (minor: number | null | undefined) =>
  minor == null ? "" : String(minor / 100);
export const money = (minor: number) =>
  `৳${(minor / 100).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

/** A blank typed-in line. Equipment counts in units; a machine is one set. */
export const emptyExternal = (
  orderKind: SalesOrderKind,
  role?: LineRole,
): EditorLine => ({
  kind: "external",
  role: orderKind === "equipment" ? (role ?? "machine") : undefined,
  description: "",
  brandOrigin: "",
  specification: "",
  model: "",
  manufacturer: "",
  origin: "",
  serialNo: "",
  unit:
    orderKind === "equipment" ? (role === "accessory" ? "set" : "unit") : "",
  unitPrice: "",
  unitCost: "",
  vatValue: "",
  vatMode: "percent",
  qty: "1",
});

/** What a line contributes to pricing, from what was typed into it. */
export function vatOf(l: EditorLine): {
  vatRateBp?: number | null;
  vatAmountMinor?: number | null;
} {
  const raw = l.vatValue.trim();
  if (raw === "") return {};
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return {};
  return l.vatMode === "percent"
    ? { vatRateBp: Math.round(n * 100) }
    : { vatAmountMinor: Math.round(n * 100) };
}
