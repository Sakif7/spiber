import { getAccessTokenCookie } from "./session";
import { verifyAccessToken, type AccessClaims } from "./tokens";

/**
 * Lightweight session derived from the access-token cookie (no DB hit).
 * Returns the JWT claims (userId, email, roles) or null if unauthenticated.
 * For full user data, load via the users repository with `claims.sub`.
 */
export async function getSessionUser(): Promise<AccessClaims | null> {
  const token = await getAccessTokenCookie();
  if (!token) return null;
  return verifyAccessToken(token);
}
