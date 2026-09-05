import type { Storefront } from "@/lib/schemas/catalog";

/**
 * Which products carry stock. Pure + framework-free so the hub page, the
 * aggregations, the movement service and the unit tests all agree.
 *
 * Default rule: every Spiber Kart product is tracked; a Medtrade product is
 * tracked once it carries a price (quotation-only instruments have no stock
 * concept, so they must never read as "low"). An explicit `trackStock` flag
 * on the product overrides the rule either way.
 */
export type TrackingFields = {
  storefront: Storefront;
  priceMinor?: number | null;
  trackStock?: boolean | null;
};

export function isStockTracked(p: TrackingFields): boolean {
  if (p.trackStock === true) return true;
  if (p.trackStock === false) return false;
  return p.storefront === "marketplace" || p.priceMinor != null;
}

/** The same rule as a Mongo aggregation expression (use inside `$addFields`). */
export const TRACKED_EXPR = {
  $switch: {
    branches: [
      { case: { $eq: ["$trackStock", true] }, then: true },
      { case: { $eq: ["$trackStock", false] }, then: false },
    ],
    default: {
      $or: [
        { $eq: ["$storefront", "marketplace"] },
        { $ne: [{ $ifNull: ["$priceMinor", null] }, null] },
      ],
    },
  },
};

/**
 * On-hand stock of a product as an aggregation expression: the sum of its
 * variants when it has any, else the base quantity.
 */
export const STOCK_EXPR = {
  $cond: [
    { $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
    { $sum: "$variants.stockQty" },
    { $ifNull: ["$stockQty", 0] },
  ],
};

/** Stock of one unit (the base product or one variant); null = unknown variant. */
export function unitStock(
  p: { stockQty?: number; variants?: { id: string; stockQty?: number }[] },
  variantId: string | null | undefined,
): number | null {
  if (variantId) {
    const v = p.variants?.find((x) => x.id === variantId);
    return v ? Number(v.stockQty ?? 0) : null;
  }
  return Number(p.stockQty ?? 0);
}

export type StockLevel = "out" | "low" | "ok";

export function stockLevel(stock: number, threshold: number): StockLevel {
  if (stock <= 0) return "out";
  if (stock <= threshold) return "low";
  return "ok";
}

/** Human label for a variant's option values, e.g. "L · Black". */
export function variantLabel(
  options: { name?: string; value: string }[] | undefined,
): string {
  return (options ?? []).map((o) => o.value).join(" · ");
}
