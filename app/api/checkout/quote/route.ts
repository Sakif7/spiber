import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { resolveCartOwner } from "@/lib/shop/cart-owner";
import { getCartView } from "@/lib/services/cart.service";
import { validateCoupon } from "@/lib/services/coupon.service";
import { getShippingSettings } from "@/lib/services/shop-settings.service";
import { priceCart, type PricingCoupon } from "@/lib/services/pricing.service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

const quoteSchema = z.object({
  couponCode: z.string().trim().max(64).optional(),
});

export async function POST(req: Request) {
  if (!rateLimit(`checkout-quote:${clientIp(req)}`, 30, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, quoteSchema);
  if (!parsed.success) return fail({ code: "invalid_input" }, 400);
  const couponCode = parsed.data.couponCode;

  const owner = await resolveCartOwner();
  const cart = await getCartView(owner, "en");

  let coupon: PricingCoupon = null;
  let couponValid: boolean | undefined;
  if (couponCode) {
    const v = await validateCoupon(
      couponCode,
      cart.subtotalMinor,
      new Date(),
      "marketplace",
    );
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
