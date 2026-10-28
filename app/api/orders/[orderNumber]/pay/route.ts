import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { isCrossSiteMutation } from "@/lib/http/same-origin";
import { getSessionUser } from "@/lib/auth/current-user";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { payOrderAgain } from "@/lib/services/payment.service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** A guest proves the order is theirs with its email, as on the lookup page. */
  email: z.string().trim().email().max(200).optional(),
  locale: z.enum(["en", "bn", "ja"]).optional(),
});

/**
 * "Pay again": a fresh try at the gateway for an order paid online whose
 * payment did not go through, while its stock is still held.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  // Only from our own pages: a stranger's site must not burn a customer's tries.
  if (isCrossSiteMutation(req)) return fail({ code: "forbidden" }, 403);
  if (!rateLimit(`order-pay:${clientIp(req)}`, 10, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.success) return fail({ code: "invalid_input" }, 400);

  const { orderNumber } = await params;
  const user = await getSessionUser();
  const result = await payOrderAgain(
    decodeURIComponent(orderNumber).slice(0, 40),
    { userId: user?.sub ?? null, email: parsed.data.email ?? null },
    parsed.data.locale,
  );
  if (!result.ok) {
    const status =
      result.reason === "not_found"
        ? 404
        : result.reason === "start_failed"
          ? 502
          : 409;
    return fail({ code: result.reason }, status);
  }
  return ok({ redirectUrl: result.redirectUrl });
}
