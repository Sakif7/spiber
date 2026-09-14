import { ok } from "@/lib/http/respond";
import { getSessionUser } from "@/lib/auth/current-user";
import { findUserById } from "@/lib/repositories/users.repo";
import { isAdmin, isEmployee } from "@/lib/auth/rbac";

/**
 * Lightweight "who am I" for client UI (navbar). Reads the access-token cookie;
 * loads the display name from the DB (JWT carries email/roles, not name).
 */
export async function GET() {
  const claims = await getSessionUser();
  if (!claims) return ok({ user: null });

  let name = claims.email.split("@")[0];
  try {
    const doc = await findUserById(claims.sub);
    if (doc?.name) name = doc.name;
  } catch {
    /* fall back to the email prefix */
  }

  return ok({
    user: {
      name,
      email: claims.email,
      roles: claims.roles,
      isAdmin: isAdmin(claims),
      // An employee's own surface is the portal, not the operations admin.
      isEmployee: isEmployee(claims),
    },
  });
}
