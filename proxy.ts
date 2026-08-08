import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { verifyAccessToken, verifyRefreshToken } from "./lib/auth/tokens";
import { isAdmin } from "./lib/auth/rbac";
import { COOKIE } from "./lib/auth/session";

/**
 * Next.js 16 network proxy (formerly `middleware.ts`), Node.js runtime.
 *
 * 1. next-intl handles locale detection + redirects.
 * 2. Coarse guards for `/{locale}/admin/*` (admin role), `/{locale}/seller/*`
 *    and `/{locale}/account/*` (any session) — jose-only, never import
 *    Mongoose here. Fine-grained checks are re-done in layouts + handlers.
 * 3. Silent renewal: when the access token is missing/expired but a
 *    signature-valid refresh token is present, bounce through
 *    /api/auth/renew (which does the DB-checked rotation) instead of dumping
 *    the user on the login modal. This is what keeps long-lived sessions
 *    seamless past the 15-minute access-token TTL.
 */
const intlMiddleware = createMiddleware(routing);

// Admin lives at the bare `/admin` (default locale, as-needed) or `/bn/admin`,
// `/ja/admin` for the prefixed locales.
const ADMIN_PATH = /^\/(?:(en|bn|ja)\/)?admin(\/|$)/;
// Seller portal: require a valid session (coarse); the seller layout re-checks
// the DB for an active Seller profile (role-based access is authoritative there).
const SELLER_PATH = /^\/(?:(en|bn|ja)\/)?seller(\/|$)/;
// Account area: require a valid session; pages keep their own redirect as a
// fallback (and for finer ownership checks).
const ACCOUNT_PATH = /^\/(?:(en|bn|ja)\/)?account(\/|$)/;

function localeOf(pathname: string): string {
  const seg = pathname.split("/")[1];
  return (routing.locales as readonly string[]).includes(seg)
    ? seg
    : routing.defaultLocale;
}

function loginRedirect(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const locale = localeOf(pathname);
  const loginUrl = request.nextUrl.clone();
  // /login + /register are gone; the auth modal opens from ?auth=login.
  // Default locale is served at "/"; other locales keep their prefix.
  loginUrl.pathname = locale === routing.defaultLocale ? "/" : `/${locale}`;
  loginUrl.search = `?auth=login&next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(loginUrl);
}

/**
 * When no valid access token exists but the refresh token at least verifies
 * (signature + expiry — tokenVersion is DB-checked in the renew route),
 * redirect through the silent renewal endpoint and back.
 */
async function renewRedirectOrNull(
  request: NextRequest,
): Promise<NextResponse | null> {
  const refreshToken = request.cookies.get(COOKIE.refresh)?.value;
  if (!refreshToken || !(await verifyRefreshToken(refreshToken))) return null;
  const renewUrl = request.nextUrl.clone();
  renewUrl.pathname = "/api/auth/renew";
  renewUrl.search = `?next=${encodeURIComponent(
    request.nextUrl.pathname + request.nextUrl.search,
  )}`;
  return NextResponse.redirect(renewUrl);
}

export default async function proxy(request: NextRequest) {
  const response = intlMiddleware(request);

  const { pathname } = request.nextUrl;
  const adminReq = ADMIN_PATH.test(pathname);
  const guarded =
    adminReq || SELLER_PATH.test(pathname) || ACCOUNT_PATH.test(pathname);

  if (guarded) {
    const token = request.cookies.get(COOKIE.access)?.value;
    const claims = token ? await verifyAccessToken(token) : null;
    const authorized = adminReq ? isAdmin(claims) : claims !== null;

    if (!authorized) {
      // Renew only when there is NO valid session at all. A valid session that
      // merely lacks the admin role is a real authorization failure — renewing
      // would loop, so it falls through to the login redirect.
      if (claims === null) {
        const renew = await renewRedirectOrNull(request);
        if (renew) return renew;
      }
      return loginRedirect(request);
    }
  }

  return response;
}

export const config = {
  // Run on everything except API routes, Next internals, and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
