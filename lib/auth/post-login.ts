/**
 * Post-sign-in routing. Pure, framework-free logic shared by BOTH the
 * standalone /login page and the auth modal, so the two can never drift apart.
 */
import { routing } from "@/i18n/routing";
import { isAdmin, isEmployee, isSeller } from "@/lib/auth/rbac";
import type { Role } from "@/lib/schemas/user";

/** The subset of the login response this module needs. */
export type AuthedUser = { roles?: string[] };

/**
 * Strip a leading locale segment (e.g. "/en/admin" → "/admin") so the
 * locale-aware router doesn't double-prefix it ("/en/en/admin"). `next` can
 * arrive locale-prefixed from the proxy/guard redirects or a bookmarked URL.
 */
export function stripLocale(path: string): string {
  for (const loc of routing.locales) {
    if (path === `/${loc}`) return "/";
    if (path.startsWith(`/${loc}/`)) return path.slice(loc.length + 1);
  }
  return path;
}

/**
 * Where to send someone immediately after they sign in.
 *
 * Precedence:
 *  1. An explicit `next` — a deep link they were already trying to reach
 *     (enrol, wishlist, buy, a guarded page the proxy bounced) always wins, so
 *     signing in never loses the thing they were doing.
 *  2. Otherwise route by role, so staff land on the surface they signed in to
 *     use rather than the marketing home page.
 *
 * Returns null for a regular customer; the caller decides what that means
 * ("stay where you are" for the modal, "go home" for the standalone page).
 *
 * NOTE: isAdmin is checked BEFORE isSeller on purpose — SELLER_ROLES includes
 * the admin roles, so an admin would otherwise match the seller branch first
 * and be sent to /seller.
 *
 * Only same-origin absolute paths are honoured; anything else (a protocol-
 * relative "//evil.com" or an absolute URL) is ignored, so `next` can't be used
 * as an open redirect.
 */
export function postLoginDestination(
  user: AuthedUser,
  next?: string,
): string | null {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return stripLocale(next);
  }
  const claims = { roles: (user.roles ?? []) as Role[] };
  if (isAdmin(claims)) return "/admin";
  // An employee who is not an admin lands on their own desk, never on the
  // operations dashboard the proxy would bounce them from.
  if (isEmployee(claims)) return "/admin/me";
  if (isSeller(claims)) return "/seller";
  return null;
}
