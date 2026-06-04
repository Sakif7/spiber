import { getSessionUser } from "./current-user";
import { isAdmin } from "./rbac";
import { findUserById } from "@/lib/repositories/users.repo";
import type { AccessClaims } from "./tokens";

/**
 * Returns the admin session claims, or null if not an admin (→ 403).
 *
 * Re-validates against the database (not just the JWT claim): an access token
 * asserts its roles for up to 15 minutes, so a revoked or disabled admin could
 * otherwise keep acting on a still-valid token. Admin routes already hit the DB,
 * so the extra lookup is cheap here.
 */
export async function requireAdmin(): Promise<AccessClaims | null> {
  const user = await getSessionUser();
  if (!isAdmin(user)) return null;
  const doc = await findUserById(user!.sub).catch(() => null);
  if (!doc || doc.disabled || !isAdmin({ roles: doc.roles })) return null;
  return user;
}
