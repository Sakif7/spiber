import { ok, fail } from "@/lib/http/respond";
import { refresh } from "@/lib/services/auth.service";
import {
  getRefreshTokenCookie,
  setAuthCookies,
  clearAuthCookies,
} from "@/lib/auth/session";

export async function POST() {
  const refreshToken = await getRefreshTokenCookie();
  if (!refreshToken) return fail({ code: "no_refresh_token" }, 401);

  const result = await refresh(refreshToken);
  if (!result.ok) {
    await clearAuthCookies();
    return fail({ code: "invalid_refresh" }, 401);
  }
  await setAuthCookies(result.tokens.accessToken, result.tokens.refreshToken);
  return ok({ user: result.user });
}
