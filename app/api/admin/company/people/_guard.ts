import { requireSuperAdmin } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/auth/rate-limit";
import { fail } from "@/lib/http/respond";

/**
 * People is super-admin only: it holds pay, personal details and money owed
 * back to directors. `requireSuperAdmin` re-validates against the database, so
 * a demoted account cannot ride a still-valid access token.
 */
export type PeopleGuard =
  | { ok: true; actor: { sub: string; email: string } }
  | { ok: false; res: ReturnType<typeof fail> };

export async function guardPeople(
  bucket: string,
  limit = 120,
): Promise<PeopleGuard> {
  const admin = await requireSuperAdmin();
  if (!admin) {
    const user = await getSessionUser();
    return {
      ok: false,
      res: fail(
        { code: user ? "forbidden" : "unauthorized" },
        user ? 403 : 401,
      ),
    };
  }
  if (!rateLimit(`${bucket}:${admin.sub}`, limit, 60_000).ok) {
    return { ok: false, res: fail({ code: "rate_limited" }, 429) };
  }
  return { ok: true, actor: { sub: admin.sub, email: admin.email } };
}

/** HTTP status for a service failure code. */
export function peopleStatus(code: string): number {
  switch (code) {
    case "not_found":
      return 404;
    case "not_editable":
    case "not_approvable":
    case "not_rejectable":
    case "not_reimbursable":
    case "wrong_settlement":
    case "already_reimbursed":
    case "month_closed":
    case "has_expenses":
      return 409;
    case "vault_not_configured":
      return 503;
    default:
      return 400;
  }
}
