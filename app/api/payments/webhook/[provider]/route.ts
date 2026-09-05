import { ok, fail } from "@/lib/http/respond";
import { getPaymentProvider } from "@/lib/payments";
import { applyPaymentWebhook } from "@/lib/services/payment.service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Gateway callback. This is the only place an order becomes paid online, and
 * it never trusts the browser: the customer's return from the gateway is just
 * navigation, while this is the server-to-server confirmation.
 *
 * Status codes matter here, because gateways retry on anything that is not a
 * 2xx:
 *   401 — signature did not verify. Retrying will not help, but this is also
 *         how an unauthenticated POST is turned away, so it must not be 200.
 *   200 — verified. Includes events we deliberately did not apply (a replay, a
 *         wrong amount, an unknown order), because a retry cannot fix those
 *         and we do not want the gateway hammering us over one bad event.
 *   500 — we genuinely failed. The gateway SHOULD retry.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: named } = await params;

  // Generous: a real gateway can burst, and blocking a callback loses money.
  // This only stops someone hosing the endpoint from one address.
  if (!rateLimit(`payment-webhook:${clientIp(req)}`, 120, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }

  let provider;
  try {
    provider = getPaymentProvider();
  } catch (e) {
    logger.error("payment webhook with no usable provider", e);
    return fail({ code: "provider_unavailable" }, 500);
  }

  // The URL names a provider so several can coexist later; it must match the
  // one actually configured, or a stale endpoint could be replayed against a
  // different gateway's verifier.
  if (named !== provider.name) return fail({ code: "unknown_provider" }, 404);
  if (!provider.verifyWebhook) return fail({ code: "not_supported" }, 404);

  let event;
  try {
    event = await provider.verifyWebhook(req);
  } catch (e) {
    logger.error("payment webhook verification threw", e);
    return fail({ code: "invalid_signature" }, 401);
  }
  if (!event) return fail({ code: "invalid_signature" }, 401);

  try {
    const outcome = await applyPaymentWebhook(provider.name, event);
    return ok({ result: outcome.result });
  } catch (e) {
    // Let the gateway retry: the event was genuine and we dropped it.
    logger.error("payment webhook processing failed", e);
    return fail({ code: "processing_failed" }, 500);
  }
}
