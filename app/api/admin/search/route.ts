import { ok, fail } from "@/lib/http/respond";
import { requireAdmin } from "@/lib/auth/guard";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { searchAdminRecords } from "@/lib/services/admin-search.service";
import type { AdminSearchResponse } from "@/lib/search/admin-dto";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Command-palette record search (orders, quotations, products, customers,
 * sellers, medical cases, appointments). Admin-only: the palette is the only
 * caller, but the guard is what actually protects customer data.
 */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  if (!rateLimit(`admin-search:${clientIp(req)}`, 90, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }

  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const empty: AdminSearchResponse = { query, total: 0, groups: [] };
  if (query.length < 2) return ok(empty);

  try {
    return ok(await searchAdminRecords(query, { perGroup: 5 }));
  } catch (e) {
    logger.error("admin search failed", e);
    return fail({ code: "search_failed" }, 500);
  }
}
