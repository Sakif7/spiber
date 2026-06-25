import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { verifyAccessToken } from "./lib/auth/tokens";
import { isAdmin } from "./lib/auth/rbac";
import { COOKIE } from "./lib/auth/session";

/**
 * Next.js 16 network proxy (formerly `middleware.ts`), Node.js runtime.
 *
 * 1. next-intl handles locale detection + redirects.
 * 2. Coarse RBAC guard for `/{locale}/admin/*`: verify the access-token cookie
 *    (jose-only — never import Mongoose here) and require an admin role.
 *    Fine-grained checks are re-done in the admin layout + handlers.
 */
const intlMiddleware = createMiddleware(routing);

// Admin lives at the bare `/admin` (default locale, as-needed) or `/bn/admin`,
// `/ja/admin` for the prefixed locales.
const ADMIN_PATH = /^\/(?:(en|bn|ja)\/)?admin(\/|$)/;

export default async function proxy(request: NextRequest) {
  const response = intlMiddleware(request);

  const { pathname } = request.nextUrl;
  if (ADMIN_PATH.test(pathname)) {
    const token = request.cookies.get(COOKIE.access)?.value;
    const claims = token ? await verifyAccessToken(token) : null;
    if (!isAdmin(claims)) {
      const seg = pathname.split("/")[1];
      const locale = (routing.locales as readonly string[]).includes(seg)
        ? seg
        : routing.defaultLocale;
      const loginUrl = request.nextUrl.clone();
      // /login + /register are gone; the auth modal opens from ?auth=login.
      // Default locale is served at "/"; other locales keep their prefix.
      loginUrl.pathname = locale === routing.defaultLocale ? "/" : `/${locale}`;
      loginUrl.search = `?auth=login&next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  // Run on everything except API routes, Next internals, and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
