import type { Role } from "@/lib/schemas/user";
import type { AccessClaims } from "./tokens";

export const ADMIN_ROLES: Role[] = ["admin", "super_admin"];

export function hasAnyRole(
  user: Pick<AccessClaims, "roles"> | null,
  roles: Role[],
): boolean {
  return Boolean(user && user.roles.some((r) => roles.includes(r)));
}

export function isAdmin(user: Pick<AccessClaims, "roles"> | null): boolean {
  return hasAnyRole(user, ADMIN_ROLES);
}
