import { getSessionUser } from "./current-user";
import { isAdmin } from "./rbac";
import type { AccessClaims } from "./tokens";

/** Returns the admin session claims, or null if not an admin (→ 403). */
export async function requireAdmin(): Promise<AccessClaims | null> {
  const user = await getSessionUser();
  return isAdmin(user) ? user : null;
}
