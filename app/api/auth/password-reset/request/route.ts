import { parseJson } from "@/lib/http/validate";
import { ok, fail } from "@/lib/http/respond";
import { passwordResetRequestSchema } from "@/lib/schemas/user";
import { requestPasswordReset } from "@/lib/services/auth.service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export async function POST(req: Request) {
  if (!rateLimit(`pwreset:${clientIp(req)}`, 5, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, passwordResetRequestSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input" }, 400);
  }
  await requestPasswordReset(parsed.data);
  // Always ok — never reveal whether the email is registered.
  return ok({});
}
