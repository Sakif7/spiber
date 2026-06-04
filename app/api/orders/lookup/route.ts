import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { findOrderForGuest } from "@/lib/repositories/orders.repo";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

// Guest order lookup requires BOTH the (unguessable) order number and the
// matching email — validated + rate-limited to blunt order/email enumeration.
const lookupSchema = z.object({
  orderNumber: z.string().trim().min(3).max(40),
  email: z.string().trim().email().max(200),
});

export async function GET(req: Request) {
  if (!rateLimit(`order-lookup:${clientIp(req)}`, 10, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const url = new URL(req.url);
  const parsed = lookupSchema.safeParse({
    orderNumber: url.searchParams.get("orderNumber"),
    email: url.searchParams.get("email"),
  });
  if (!parsed.success) return fail({ code: "invalid_input" }, 400);

  const order = await findOrderForGuest(
    parsed.data.orderNumber,
    parsed.data.email,
  );
  if (!order) return fail({ code: "not_found" }, 404);
  return ok({ order });
}
