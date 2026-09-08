/** Client-safe stock unit for the inventory hub table and its drawers. */
export type HubUnit = {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  sku: string;
  storefront: "instruments" | "marketplace";
  storeLabel: string;
  status: string;
  tracked: boolean;
  trackStock: boolean | null;
  /** On hand — what a stock count finds on the shelf. */
  stock: number;
  /** Of that, how much is committed to an invoiced sales order. */
  reserved: number;
  /** `stock - reserved` — what can still be sold. Drives the low/out level. */
  available: number;
  threshold: number;
  level: "out" | "low" | "ok" | null;
  priceMinor: number | null;
  /** Pre-formatted stock value (stock × unit price), null when unpriced. */
  valueLabel: string | null;
  seller: { id: string; name: string } | null;
  categoryName: string | null;
  brandName: string | null;
  editorHref: string;
  historyHref: string;
  lastMovement: { at: string; type: string; qtyDelta: number } | null;
};

export const MANUAL_TYPES = [
  { value: "purchase", label: "Received (delivery)" },
  { value: "adjustment", label: "Adjustment (count / correction)" },
  { value: "return", label: "Return" },
] as const;

export type ManualType = (typeof MANUAL_TYPES)[number]["value"];

export const LEVEL_LABEL: Record<NonNullable<HubUnit["level"]>, string> = {
  out: "Out",
  low: "Low",
  ok: "OK",
};

export function unitTitle(u: Pick<HubUnit, "name" | "variantLabel">): string {
  return u.variantLabel ? `${u.name} · ${u.variantLabel}` : u.name;
}

export function formatDelta(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
