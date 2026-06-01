import { parseJson } from "@/lib/http/validate";
import { ok, fail } from "@/lib/http/respond";
import { loginInputSchema } from "@/lib/schemas/user";
import { login } from "@/lib/services/auth.service";
import { setAuthCookies } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export async function POST(req: Request) {
  if (!rateLimit(`login:${clientIp(req)}`, 10, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, loginInputSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const result = await login(parsed.data);
  if (!result.ok) {
    return fail(
      { code: result.code },
      result.code === "email_not_verified" ? 403 : 401,
    );
  }
  await setAuthCookies(result.tokens.accessToken, result.tokens.refreshToken);
  return ok({ user: result.user });
}
