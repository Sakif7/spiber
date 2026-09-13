import { getSessionUser } from "./current-user";
import { isAdmin, isStaff, isSuperAdmin } from "./rbac";
import { findUserById } from "@/lib/repositories/users.repo";
import { getSellerByUserId } from "@/lib/repositories/sellers.repo";
import { findEmployeeByUserId } from "@/lib/repositories/employees.repo";
import type { Lean } from "@/lib/models/_shared";
import type { ISeller } from "@/lib/models/seller";
import type { IEmployee } from "@/lib/models/employee";
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

/**
 * Anyone allowed into the staff side of the shell — an employee, or an admin.
 * DB re-validated like `requireAdmin`: a person taken off the payroll loses
 * access at once, not when their access token happens to expire.
 */
export async function requireStaff(): Promise<AccessClaims | null> {
  const user = await getSessionUser();
  if (!isStaff(user)) return null;
  const doc = await findUserById(user!.sub).catch(() => null);
  if (!doc || doc.disabled || !isStaff({ roles: doc.roles })) return null;
  return user;
}

export type EmployeeSession = {
  claims: AccessClaims;
  employee: Lean<IEmployee>;
};

/**
 * The employee portal needs a person, not just a role: everything it shows is
 * filtered by the Employee record linked to the signed-in user. An admin with
 * no Employee record gets null here and an explanatory card, not a 500.
 * Gates on an ACTIVE record so someone marked as left is out immediately.
 */
export async function requireEmployee(): Promise<EmployeeSession | null> {
  const claims = await requireStaff();
  if (!claims) return null;
  const employee = await findEmployeeByUserId(claims.sub).catch(() => null);
  if (!employee || employee.status !== "active") return null;
  return { claims, employee };
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
