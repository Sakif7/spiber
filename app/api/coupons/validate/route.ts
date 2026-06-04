import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { couponCodeSchema } from "@/lib/schemas/coupon";
import { validateCoupon } from "@/lib/services/coupon.service";
import { getCartView } from "@/lib/services/cart.service";
import { resolveCartOwner } from "@/lib/shop/cart-owner";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export async function POST(req: Request) {
  // Throttle to blunt coupon-code brute-forcing on this public endpoint.
  if (!rateLimit(`coupon-validate:${clientIp(req)}`, 15, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, couponCodeSchema);
  if (!parsed.success) return fail({ code: "invalid_input" }, 400);

  const owner = await resolveCartOwner();
  const cart = await getCartView(owner, "en");
  const result = await validateCoupon(
    parsed.data.code,
    cart.subtotalMinor,
    new Date(),
    "marketplace",
  );
  if (!result.ok) return fail({ code: result.reason }, 400);

  return ok({ coupon: result.coupon });
}
