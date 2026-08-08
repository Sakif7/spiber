import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { refresh } from "@/lib/services/auth.service";
import {
  getRefreshTokenCookie,
  clearAuthCookies,
  authCookieSpecs,
} from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

/**
 * Silent session renewal for server-guarded pages (GET so it can sit in a
 * redirect chain). The proxy sends users here when their access token has
 * expired but a plausibly-valid refresh token is still present:
 *
 *   guarded page → proxy → /api/auth/renew?next=… → back to the guarded page
 *
 * On success the rotated token pair is set on the redirect itself; on failure
 * the auth cookies are cleared (so the proxy can't loop us back here) and the
 * user lands on the login modal with `next` preserved.
 */

/** Only same-origin absolute paths — rejects "//host" and external URLs. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));

  // Login-modal fallback, on the locale the user was browsing.
  const seg = next.split("/")[1];
  const locale = (routing.locales as readonly string[]).includes(seg)
    ? seg
    : routing.defaultLocale;
  const toLogin = new URL(
    locale === routing.defaultLocale ? "/" : `/${locale}`,
    url.origin,
  );
  toLogin.searchParams.set("auth", "login");
  toLogin.searchParams.set("next", next);

  if (!rateLimit(`renew:${clientIp(req)}`, 30, 60_000).ok) {
    return NextResponse.redirect(toLogin);
  }

  const refreshToken = await getRefreshTokenCookie();
  if (!refreshToken) return NextResponse.redirect(toLogin);

  const result = await refresh(refreshToken);
  if (!result.ok) {
    // Revoked/expired refresh: clear both cookies so the next proxy pass goes
    // straight to login instead of bouncing back here.
    await clearAuthCookies();
    return NextResponse.redirect(toLogin);
  }

  const res = NextResponse.redirect(new URL(next, url.origin));
  for (const c of authCookieSpecs(
    result.tokens.accessToken,
    result.tokens.refreshToken,
  )) {
    res.cookies.set(c.name, c.value, c.options);
  }
  return res;
}
