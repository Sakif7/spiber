import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { z } from "zod";
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
  const parsed = await parseJson(
    req,
    // The coupon's scope must match the storefront being checked out, or a
    // Kart-only coupon would validate against a Medtrade cart.
    couponCodeSchema.extend({
      storefront: z.enum(["instruments", "marketplace"]).optional(),
    }),
  );
  if (!parsed.success) return fail({ code: "invalid_input" }, 400);
  const storefront = parsed.data.storefront ?? "marketplace";

  const owner = await resolveCartOwner();
  const cart = await getCartView(owner, "en", storefront);
  const result = await validateCoupon(
    parsed.data.code,
    cart.subtotalMinor,
    new Date(),
    storefront,
  );
  if (!result.ok) return fail({ code: result.reason }, 400);

  return ok({ coupon: result.coupon });
}
