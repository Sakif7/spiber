import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { buyInputSchema } from "@/lib/schemas/systems";
import { buySoftware } from "@/lib/services/software.service";
import { getSessionUser } from "@/lib/auth/current-user";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { startDigitalPayment } from "@/lib/services/payment.service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!rateLimit(`buy:${clientIp(req)}`, 10, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const user = await getSessionUser();
  if (!user) return fail({ code: "unauthorized" }, 401);

  const parsed = await parseJson(req, buyInputSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const result = await buySoftware({
    softwareProductId: parsed.data.softwareProductId,
    userId: user.sub,
    email: user.email,
    idempotencyKey: parsed.data.idempotencyKey,
    couponCode: parsed.data.couponCode,
  });
  if (!result.ok) {
    return fail(
      { code: result.code },
      result.code === "product_not_found" ? 404 : 409,
    );
  }
  // Paid online when it can be: straight to PayStation, as checkout does.
  // Anything that stops it (gateway off, an external app, no phone on the
  // profile) just leaves the customer on the purchase page to pay from.
  let redirectUrl: string | undefined;
  if (result.purchase.status === "pending") {
    const started = await startDigitalPayment(
      "software",
      result.purchase.purchaseNumber,
      { userId: user.sub },
      { locale: parsed.data.locale },
    ).catch(() => null);
    if (started?.ok) redirectUrl = started.redirectUrl;
  }
  return ok({
    purchaseNumber: result.purchase.purchaseNumber,
    status: result.purchase.status,
    totalMinor: result.purchase.totalMinor,
    redirectUrl,
  });
}
