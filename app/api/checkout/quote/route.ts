import { ok } from "@/lib/http/respond";
import { resolveCartOwner } from "@/lib/shop/cart-owner";
import { getCartView } from "@/lib/services/cart.service";
import { validateCoupon } from "@/lib/services/coupon.service";
import { getShippingSettings } from "@/lib/services/shop-settings.service";
import { priceCart, type PricingCoupon } from "@/lib/services/pricing.service";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const couponCode =
    typeof body?.couponCode === "string" ? body.couponCode : undefined;

  const owner = await resolveCartOwner();
  const cart = await getCartView(owner, "en");

  let coupon: PricingCoupon = null;
  let couponValid: boolean | undefined;
  if (couponCode) {
    const v = await validateCoupon(couponCode, cart.subtotalMinor);
    couponValid = v.ok;
    if (v.ok) {
      coupon = {
        type: v.coupon.type,
        value: v.coupon.value,
        minSubtotalMinor: v.coupon.minSubtotalMinor,
      };
    }
  }

  const shipping = await getShippingSettings();
  const totals = priceCart(
    cart.items.map((i) => ({ priceMinor: i.priceMinor, qty: i.qty })),
    coupon,
    shipping,
  );

  return ok({ totals, couponValid, count: cart.count });
}
