/**
 * Pure cart pricing. No DB, no side effects — fully unit-testable.
 * All amounts are integer poisha. Shipping = flat fee, waived above an
 * optional free-shipping threshold (compared against the post-discount
 * subtotal). Tax is 0 for Phase 1.
 */

export type ShippingSettings = {
  flatFeeMinor: number;
  freeThresholdMinor: number | null;
};

export type PricingCoupon = {
  type: "percent" | "fixed";
  value: number;
  minSubtotalMinor?: number;
} | null;

export type CartLine = { priceMinor: number; qty: number };

export type PricedTotals = {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
};

export function priceCart(
  lines: CartLine[],
  coupon: PricingCoupon,
  shipping: ShippingSettings,
): PricedTotals {
  const subtotalMinor = lines.reduce((sum, l) => sum + l.priceMinor * l.qty, 0);

  let discountMinor = 0;
  if (
    coupon &&
    (coupon.minSubtotalMinor == null ||
      subtotalMinor >= coupon.minSubtotalMinor)
  ) {
    discountMinor =
      coupon.type === "percent"
        ? Math.round((subtotalMinor * coupon.value) / 100)
        : coupon.value;
    discountMinor = Math.min(discountMinor, subtotalMinor); // never below zero
  }

  const discountedSubtotal = subtotalMinor - discountMinor;

  let shippingMinor = 0;
  if (subtotalMinor > 0) {
    const free =
      shipping.freeThresholdMinor != null &&
      discountedSubtotal >= shipping.freeThresholdMinor;
    shippingMinor = free ? 0 : shipping.flatFeeMinor;
  }

  const taxMinor = 0;
  const totalMinor = discountedSubtotal + shippingMinor + taxMinor;

  return { subtotalMinor, discountMinor, shippingMinor, taxMinor, totalMinor };
}
