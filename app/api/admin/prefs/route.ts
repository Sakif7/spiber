import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { adminPrefsUpdateSchema } from "@/lib/schemas/user";
import { getAdminPrefsRaw, setAdminPrefs } from "@/lib/repositories/users.repo";
import { NAV_BY_ID } from "@/components/admin/shell/nav";
import { pushRecent, sanitizePrefs, type AdminPrefs } from "@/lib/admin/prefs";
import { sanitizeSheetLayout } from "@/lib/admin/sales-sheet";

export const dynamic = "force-dynamic";

const isKnownId = (id: string) => NAV_BY_ID.has(id);

async function loadPrefs(userId: string): Promise<AdminPrefs> {
  return sanitizePrefs(await getAdminPrefsRaw(userId), isKnownId);
}

/** The signed-in admin's own sidebar preferences. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  return ok({ prefs: await loadPrefs(admin.sub) });
}

/**
 * Self-only update: replace the favourites list and/or record one visit.
 * Unknown ids are dropped rather than rejected, so a page that was removed
 * from the nav can never wedge an admin's saved preferences.
 */
export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  if (!rateLimit(`admin-prefs:${clientIp(req)}`, 120, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, adminPrefsUpdateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const current = await loadPrefs(admin.sub);
  let next: AdminPrefs = current;
  if (parsed.data.favourites !== undefined) {
    next = sanitizePrefs(
      { favourites: parsed.data.favourites, recents: next.recents },
      isKnownId,
    );
  }
  if (parsed.data.recent !== undefined && isKnownId(parsed.data.recent)) {
    next = { ...next, recents: pushRecent(next.recents, parsed.data.recent) };
  }

  if (parsed.data.salesSheet !== undefined) {
    // Sanitised here as well as on read: what an admin sends is not the
    // authority on which columns exist.
    next = {
      ...next,
      salesSheet: sanitizeSheetLayout(parsed.data.salesSheet),
    };
  }

  await setAdminPrefs(admin.sub, {
    favourites: next.favourites,
    recents: next.recents.map((r) => ({ id: r.id, at: new Date(r.at) })),
    salesSheet: next.salesSheet ?? null,
  });
  // Read back rather than echoing what we just built in memory: a field the
  // schema does not know about is dropped silently on write, and returning the
  // in-memory value would report a success that never reached the database.
  return ok({ prefs: await loadPrefs(admin.sub) });
}
