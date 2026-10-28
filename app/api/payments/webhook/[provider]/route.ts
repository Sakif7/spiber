import { ok, fail } from "@/lib/http/respond";
import { paymentProviderStatus } from "@/lib/payments";
import { confirmAttempt } from "@/lib/services/payment.service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * The gateway's server-to-server notification (PayStation's IPN; register
 * `https://spibermed.com/api/payments/webhook/paystation` with them).
 *
 * PayStation's IPN is unsigned and anyone can POST here, so the body is read
 * for one thing only — which invoice it is about — and the state and amount
 * are then asked of PayStation over our own connection (`confirmAttempt`).
 * A forged notification therefore achieves nothing but a status lookup.
 *
 * Status codes matter, because PayStation retries anything that is not 2xx:
 *   200 — handled, including "nothing to do" (unknown invoice, already
 *         settled, not paid): a retry cannot change those.
 *   400 — not a notification at all.
 *   404 — the URL names a gateway that is not the one configured.
 *   500 — we could not ask the gateway or write the result: retry, please.
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

  const status = paymentProviderStatus();
  if (!status.ok) {
    logger.error(`payment webhook with no usable provider: ${status.error}`);
    return fail({ code: "provider_unavailable" }, 500);
  }
  const provider = status.provider;
  // The URL names a provider so a stale endpoint cannot be pointed at a
  // different gateway's lookup.
  if (named !== provider.name) return fail({ code: "unknown_provider" }, 404);
  if (!provider.readNotification) return fail({ code: "not_supported" }, 404);

  const invoiceNumber = await provider.readNotification(req);
  if (!invoiceNumber) return fail({ code: "invalid_notification" }, 400);

  try {
    const outcome = await confirmAttempt(invoiceNumber, "ipn");
    return ok({ result: outcome.result });
  } catch (e) {
    logger.error(`payment notification for ${invoiceNumber} not processed`, e);
    return fail({ code: "processing_failed" }, 500);
  }
}
