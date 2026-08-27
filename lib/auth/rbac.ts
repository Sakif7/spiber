import type { Role } from "@/lib/schemas/user";
import type { AccessClaims } from "./tokens";

export const ADMIN_ROLES: Role[] = ["admin", "super_admin"];
/** Roles allowed into the seller area (an admin may inspect it too). */
export const SELLER_ROLES: Role[] = ["seller", "admin", "super_admin"];

export function hasAnyRole(
  user: Pick<AccessClaims, "roles"> | null,
  roles: Role[],
): boolean {
  return Boolean(user && user.roles.some((r) => roles.includes(r)));
}

export function isAdmin(user: Pick<AccessClaims, "roles"> | null): boolean {
  return hasAnyRole(user, ADMIN_ROLES);
}

export function isSuperAdmin(
  user: Pick<AccessClaims, "roles"> | null,
): boolean {
  return hasAnyRole(user, ["super_admin"]);
}

export function isSeller(user: Pick<AccessClaims, "roles"> | null): boolean {
  return hasAnyRole(user, SELLER_ROLES);
}
