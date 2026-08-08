import { parseJson } from "@/lib/http/validate";
import { ok, fail } from "@/lib/http/respond";
import { refundRequestSchema } from "@/lib/schemas/order";
import { getSessionUser } from "@/lib/auth/current-user";
import { requestRefund } from "@/lib/services/order.service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

/**
 * Customer requests a refund. Eligibility (paid/processing/shipped, or
 * delivered within the return window) is enforced in the service; an admin
 * settles the request with the existing cancel/refund transitions.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const session = await getSessionUser();
  if (!session) return fail({ code: "unauthorized" }, 401);
  if (!rateLimit(`refund-request:${clientIp(req)}`, 5, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, refundRequestSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const { orderNumber } = await params;
  const result = await requestRefund(
    orderNumber,
    session.sub,
    parsed.data.reason,
  );
  if (!result.ok) {
    return fail({ code: result.code }, result.code === "not_found" ? 404 : 409);
  }
  return ok({ requested: true });
}
