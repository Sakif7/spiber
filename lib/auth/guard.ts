import { getSessionUser } from "./current-user";
import { isAdmin, isSuperAdmin } from "./rbac";
import { findUserById } from "@/lib/repositories/users.repo";
import { getSellerByUserId } from "@/lib/repositories/sellers.repo";
import type { Lean } from "@/lib/models/_shared";
import type { ISeller } from "@/lib/models/seller";
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

/**
 * Super-admin only (company document vault, …). Same DB re-validation as
 * `requireAdmin` — a demoted/disabled super-admin can't ride a still-valid
 * access token.
 */
export async function requireSuperAdmin(): Promise<AccessClaims | null> {
  const user = await getSessionUser();
  if (!isSuperAdmin(user)) return null;
  const doc = await findUserById(user!.sub).catch(() => null);
  if (!doc || doc.disabled || !isSuperAdmin({ roles: doc.roles })) return null;
  return user;
}

export type SellerSession = { claims: AccessClaims; seller: Lean<ISeller> };

/**
 * Returns the seller session (claims + active Seller profile), or null → redirect.
 *
 * DB-authoritative: gates on an ACTIVE `Seller` profile (created at approval)
 * rather than only the JWT role, so a freshly-approved seller works without
 * re-logging-in, and a suspended/removed seller is locked out immediately even
 * on a still-valid token.
 */
export async function requireSeller(): Promise<SellerSession | null> {
  const claims = await getSessionUser();
  if (!claims) return null;
  const doc = await findUserById(claims.sub).catch(() => null);
  if (!doc || doc.disabled) return null;
  const seller = await getSellerByUserId(claims.sub).catch(() => null);
  if (!seller || seller.status !== "active") return null;
  return { claims, seller };
}
