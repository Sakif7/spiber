import { requireStaff } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/current-user";
import { isAdmin } from "@/lib/auth/rbac";
import { rateLimit } from "@/lib/auth/rate-limit";
import { fail } from "@/lib/http/respond";
import type { ReviewActor } from "@/lib/services/documents/document-review.service";
import type { DocumentError } from "@/lib/services/documents/authored-document.service";

/**
 * A reviewer is anyone on the staff side of the shell — a director asked
 * by name, or an admin; whether they may see *this* document is decided
 * in the service against the document's own reviewer list. Unlike the
 * rest of the portal, no Employee record is needed: an admin without one
 * still reviews.
 */
export type ReviewerGuard =
  | { ok: true; actor: ReviewActor }
  | { ok: false; res: ReturnType<typeof fail> };

export async function guardReviewer(
  bucket: string,
  limit = 60,
): Promise<ReviewerGuard> {
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
  if (!rateLimit(`reviews:${bucket}:${claims.sub}`, limit, 60_000).ok) {
    return { ok: false, res: fail({ code: "rate_limited" }, 429) };
  }
  return { ok: true, actor: { sub: claims.sub, isAdmin: isAdmin(claims) } };
}

export function reviewStatus(code: DocumentError): number {
  switch (code) {
    case "not_found":
      return 404;
    case "locked":
    case "stale":
      return 409;
    case "print_failed":
    case "vault_failed":
      return 503;
    default:
      return 400;
  }
}
