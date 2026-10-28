import { requireSuperAdmin } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/auth/rate-limit";
import { fail } from "@/lib/http/respond";

/**
 * Sales is super-admin only: it holds client pricing, negotiation history and
 * the company's revenue. `requireSuperAdmin` re-validates against the database,
 * so a demoted account cannot ride a still-valid access token.
 */
export type SalesGuard =
  | { ok: true; actor: { sub: string; email: string } }
  | { ok: false; res: ReturnType<typeof fail> };

export async function guardSales(
  bucket: string,
  limit = 120,
): Promise<SalesGuard> {
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
export function salesStatus(code: string): number {
  switch (code) {
    case "not_found":
    case "lead_not_found":
      return 404;
    case "code_taken":
      return 409;
    case "insufficient_stock":
    case "no_items":
    case "too_many_machines":
    case "no_price":
      return 409;
    case "paid_order":
    case "not_editable":
    case "invalid_transition":
    case "not_invoiced":
    case "nothing_to_pay":
    case "payment_unavailable":
      return 409;
    case "recipient_mismatch":
      return 409;
    case "vault_not_configured":
      return 503;
    default:
      return 400;
  }
}
