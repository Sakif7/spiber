import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { isCrossSiteMutation } from "@/lib/http/same-origin";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { payLinkStartSchema } from "@/lib/schemas/payment";
import { startLinkPayment } from "@/lib/services/payment-link.service";

export const dynamic = "force-dynamic";

/**
 * Pay on a pay link (`/pay/<token>`): a fresh try at the gateway for the
 * link's amount, answered with where to send the payer. No sign-in — the
 * token is the key, and the client paying an invoice usually has no account.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  // Only from our own page: a stranger's site must not burn a link's tries.
  if (isCrossSiteMutation(req)) return fail({ code: "forbidden" }, 403);
  if (!rateLimit(`pay-link:${clientIp(req)}`, 10, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, payLinkStartSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const { token } = await params;
  const result = await startLinkPayment(token, parsed.data);
  if (!result.ok) {
    const status =
      result.reason === "not_found"
        ? 404
        : result.reason === "start_failed"
          ? 502
          : result.reason === "phone_required"
            ? 422
            : 409;
    return fail({ code: result.reason }, status);
  }
  return ok({ redirectUrl: result.redirectUrl });
}
