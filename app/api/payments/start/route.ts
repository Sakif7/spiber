import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { isCrossSiteMutation } from "@/lib/http/same-origin";
import { getSessionUser } from "@/lib/auth/current-user";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { startDigitalPayment } from "@/lib/services/payment.service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  kind: z.enum(["software", "enrollment"]),
  /** The purchase or enrollment number. */
  ref: z.string().trim().min(3).max(60),
  /** Only when the profile has no phone: PayStation requires one. */
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 -]{6,20}$/, "Enter a phone number")
    .optional(),
  locale: z.enum(["en", "bn", "ja"]).optional(),
});

/**
 * "Pay now" for the signed-in customer's own pending software purchase or
 * course enrollment: a fresh try at the gateway, answered with where to send
 * them.
 */
export async function POST(req: Request) {
  if (isCrossSiteMutation(req)) return fail({ code: "forbidden" }, 403);
  if (!rateLimit(`payment-start:${clientIp(req)}`, 10, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const user = await getSessionUser();
  if (!user) return fail({ code: "unauthorized" }, 401);
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const { kind, ref, phone, locale } = parsed.data;
  const result = await startDigitalPayment(
    kind,
    ref,
    { userId: user.sub },
    { phone, locale },
  );
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
