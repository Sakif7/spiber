import { ok, fail } from "@/lib/http/respond";
import { getSessionUser } from "@/lib/auth/current-user";
import { cancelOwnOrder } from "@/lib/services/order.service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

/** Customer cancels their own (still-pending, unpaid) order. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const session = await getSessionUser();
  if (!session) return fail({ code: "unauthorized" }, 401);
  if (!rateLimit(`order-cancel:${clientIp(req)}`, 10, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const { orderNumber } = await params;
  const result = await cancelOwnOrder(orderNumber, session.sub);
  if (!result.ok) {
    return fail({ code: result.code }, result.code === "not_found" ? 404 : 409);
  }
  return ok({ status: result.order.status });
}
