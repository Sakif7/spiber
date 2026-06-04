import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { checkoutSchema } from "@/lib/schemas/order";
import { placeOrder } from "@/lib/services/order.service";
import { resolveCartOwner } from "@/lib/shop/cart-owner";
import { getSessionUser } from "@/lib/auth/current-user";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export async function POST(req: Request) {
  if (!rateLimit(`checkout:${clientIp(req)}`, 10, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, checkoutSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const owner = await resolveCartOwner();
  const user = await getSessionUser();
  const result = await placeOrder(parsed.data, owner, user?.sub, "marketplace");
  if (!result.ok) return fail({ code: result.code }, 409);
  return ok({
    orderNumber: result.order.orderNumber,
    totalMinor: result.order.totalMinor,
    email: result.order.email,
  });
}
