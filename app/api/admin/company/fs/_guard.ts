import { requireSuperAdmin } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/auth/rate-limit";
import { fail } from "@/lib/http/respond";
import type { Actor, FsError } from "@/lib/services/company-fs.service";

/**
 * Shared entry check for every file-manager route.
 *
 * The vault is super-admin only, and `requireSuperAdmin` re-validates against
 * the database, so a demoted or disabled account cannot ride a still-valid
 * access token. 401 and 403 are kept distinct: the UI needs to tell "sign in"
 * apart from "you are signed in, but this is not for you".
 */
export type Guarded =
  | { ok: true; actor: Actor }
  | { ok: false; res: ReturnType<typeof fail> };

export async function guardFs(bucket: string, limit = 120): Promise<Guarded> {
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

/** Map a service failure onto the HTTP status that describes it. */
export function fsStatus(code: FsError): number {
  switch (code) {
    case "not_found":
    case "not_trashed":
      return 404;
    case "name_taken":
      return 409;
    case "too_large":
    case "quota_exceeded":
    case "too_many_files":
      return 413;
    case "bad_type":
      return 415;
    case "vault_not_configured":
      return 503;
    default:
      // cycle, too_deep — the request is well-formed but not allowed.
      return 400;
  }
}

export function fsFail(code: FsError) {
  return fail({ code }, fsStatus(code));
}
