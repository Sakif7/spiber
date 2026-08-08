import { parseJson } from "@/lib/http/validate";
import { ok, fail } from "@/lib/http/respond";
import { resendVerificationSchema } from "@/lib/schemas/user";
import { resendVerification } from "@/lib/services/auth.service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

/**
 * Re-send the account verification email. Anti-enumeration: always returns ok,
 * whether or not the address matches an unverified account. Double rate-limit:
 * per client IP and per target email (so one IP can't spam many inboxes and a
 * distributed caller can't hammer one inbox).
 */
export async function POST(req: Request) {
  if (!rateLimit(`resend-verify:${clientIp(req)}`, 5, 5 * 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, resendVerificationSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  if (
    !rateLimit(`resend-verify:email:${parsed.data.email}`, 3, 10 * 60_000).ok
  ) {
    return fail({ code: "rate_limited" }, 429);
  }
  await resendVerification(parsed.data.email, parsed.data.locale);
  return ok({ sent: true });
}
