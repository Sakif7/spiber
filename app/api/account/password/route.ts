import { parseJson } from "@/lib/http/validate";
import { ok, fail } from "@/lib/http/respond";
import { changePasswordSchema } from "@/lib/schemas/user";
import { changePassword } from "@/lib/services/auth.service";
import { getSessionUser } from "@/lib/auth/current-user";
import { setAuthCookies } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

/**
 * Change the logged-in user's password. Verifies the current password, bumps
 * tokenVersion (logging out every other device), and rotates THIS session's
 * cookies to the new version so the user stays signed in here.
 */
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return fail({ code: "unauthorized" }, 401);
  if (!rateLimit(`change-password:${clientIp(req)}`, 5, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, changePasswordSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const result = await changePassword(
    session.sub,
    parsed.data.currentPassword,
    parsed.data.newPassword,
  );
  if (!result.ok) {
    return fail(
      { code: result.code },
      result.code === "invalid_current" ? 403 : 404,
    );
  }
  await setAuthCookies(result.tokens.accessToken, result.tokens.refreshToken);
  return ok({ user: result.user });
}
