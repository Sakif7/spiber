/**
 * Pure cart pricing. No DB, no side effects — fully unit-testable.
 * All amounts are integer poisha. Shipping = flat fee, waived above an
 * optional free-shipping threshold (compared against the post-discount
 * subtotal).
 *
 * TAX (VAT): opt-in per storefront via the 4th argument. Medtrade passes the
 * configured VAT rate; Spiber Kart passes nothing and stays tax-free, so its
 * totals are byte-identical to before this parameter existed. VAT is charged on
 * the post-discount GOODS subtotal — shipping is excluded from the base.
 *
 * AIT is deliberately absent here: it is withheld at source by the buyer, so it
 * never changes what we charge. It is derived for display on the invoice only.
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

/** VAT configuration in basis points (1500 = 15%). null/omitted = no tax. */
export type TaxSettings = { rateBp: number } | null;

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
  tax: TaxSettings = null,
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

  // VAT on the discounted goods subtotal (shipping excluded from the base).
  const taxMinor =
    tax && tax.rateBp > 0 && subtotalMinor > 0
      ? Math.round((discountedSubtotal * tax.rateBp) / 10000)
      : 0;
  const totalMinor = discountedSubtotal + shippingMinor + taxMinor;

  return { subtotalMinor, discountMinor, shippingMinor, taxMinor, totalMinor };
}
