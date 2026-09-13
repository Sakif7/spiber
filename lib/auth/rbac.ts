import type { Role } from "@/lib/schemas/user";
import type { AccessClaims } from "./tokens";

export const ADMIN_ROLES: Role[] = ["admin", "super_admin"];
/**
 * Roles allowed into the staff-facing part of the admin shell (the employee
 * portal + the mailbox). Admins are staff too; a plain employee is not an admin.
 */
export const STAFF_ROLES: Role[] = ["employee", "admin", "super_admin"];
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

/** Holds the employee role itself (an admin without it is not "an employee"). */
export function isEmployee(user: Pick<AccessClaims, "roles"> | null): boolean {
  return hasAnyRole(user, ["employee"]);
}

export function isStaff(user: Pick<AccessClaims, "roles"> | null): boolean {
  return hasAnyRole(user, STAFF_ROLES);
}
