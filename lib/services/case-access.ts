import type { AccessClaims } from "@/lib/auth/tokens";
import { isAdmin } from "@/lib/auth/rbac";

/**
 * Who may view a medical case's documents (personal health data). Per the brief,
 * viewing is restricted to the assigned case manager + admins — NOT the patient.
 * Case managers are admins (no separate role), and assignment scopes access:
 *
 *  - super_admin  → always (oversight of the whole pipeline);
 *  - admin        → only the assigned case manager, OR any admin while the case
 *                   is still unassigned (triage/review before assignment);
 *  - anyone else  → never (incl. the patient who uploaded the reports).
 */
export function canViewCaseDocuments(
  user: Pick<AccessClaims, "roles" | "sub"> | null,
  assignedTo: string | null | undefined,
): boolean {
  if (!isAdmin(user)) return false;
  if (user!.roles.includes("super_admin")) return true;
  if (assignedTo == null) return true; // unassigned → any admin may triage
  return String(assignedTo) === user!.sub;
}
