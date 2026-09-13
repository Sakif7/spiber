import { requireStaff } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/auth/rate-limit";
import { fail } from "@/lib/http/respond";
import type { AccessClaims } from "@/lib/auth/tokens";
import {
  mailboxAccess,
  MailStoreError,
  type MailAccess,
} from "@/lib/services/mail.service";

/**
 * Every mail route: a staff session (DB re-validated), a per-person rate
 * limit, and — when a mailbox is named — the access rule from the service.
 * A mailbox the person may not open reads as 404, never 403, so the address
 * list cannot be probed.
 */
export type MailGuard =
  | { ok: true; claims: AccessClaims; access: MailAccess }
  | { ok: false; res: ReturnType<typeof fail> };

export async function guardMailbox(
  address: string,
  bucket: string,
  limit = 240,
): Promise<MailGuard> {
  const claims = await requireStaff();
  if (!claims) {
    const user = await getSessionUser();
    return {
      ok: false,
      res: fail(
        { code: user ? "forbidden" : "unauthorized" },
        user ? 403 : 401,
      ),
    };
  }
  if (!rateLimit(`mail:${bucket}:${claims.sub}`, limit, 60_000).ok) {
    return { ok: false, res: fail({ code: "rate_limited" }, 429) };
  }
  const access = await mailboxAccess(claims, decodeURIComponent(address));
  if (!access) return { ok: false, res: fail({ code: "not_found" }, 404) };
  return { ok: true, claims, access };
}

/** Store failures → honest HTTP statuses (never a 500 for a known case). */
export function storeError(e: unknown) {
  if (!(e instanceof MailStoreError)) throw e;
  const status =
    e.code === "not_configured"
      ? 503
      : e.code === "auth_failed" || e.code === "unavailable"
        ? 502
        : e.code === "not_found"
          ? 404
          : e.code === "too_large"
            ? 413
            : 500;
  return fail({ code: `mail_${e.code}`, message: e.message }, status);
}
