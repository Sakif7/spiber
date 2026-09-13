import { requireEmployee, type EmployeeSession } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/auth/rate-limit";
import { fail } from "@/lib/http/respond";

/**
 * The employee portal's write routes: an active Employee record behind the
 * login (DB re-validated), a per-person rate limit. Every handler then pins
 * the record to the session (attendee, claimant) — the body never chooses
 * who a visit or a claim belongs to.
 */
export type MeGuard =
  | {
      ok: true;
      session: EmployeeSession;
      actor: { sub: string; email: string };
    }
  | { ok: false; res: ReturnType<typeof fail> };

export async function guardMe(bucket: string, limit = 60): Promise<MeGuard> {
  const session = await requireEmployee();
  if (!session) {
    const user = await getSessionUser();
    return {
      ok: false,
      res: fail(
        { code: user ? "forbidden" : "unauthorized" },
        user ? 403 : 401,
      ),
    };
  }
  if (!rateLimit(`me:${bucket}:${session.claims.sub}`, limit, 60_000).ok) {
    return { ok: false, res: fail({ code: "rate_limited" }, 429) };
  }
  return {
    ok: true,
    session,
    actor: { sub: session.claims.sub, email: session.claims.email },
  };
}
