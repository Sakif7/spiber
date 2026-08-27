import { requireAdmin } from "@/lib/auth/guard";
import { ok, fail } from "@/lib/http/respond";
import {
  listAdminNotifications,
  countUnreadNotifications,
} from "@/lib/repositories/notifications.repo";

export const dynamic = "force-dynamic";

/**
 * The admin bell feed: latest notifications + this admin's unread count.
 * Polled (~30s) by the topbar bell.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);

  const [items, unread] = await Promise.all([
    listAdminNotifications(30),
    countUnreadNotifications(admin.sub),
  ]);

  return ok({
    unread,
    items: items.map((n) => ({
      id: String(n._id),
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      href: n.href,
      severity: n.severity ?? "info",
      entityRef: n.entity?.ref ?? null,
      createdAt: n.createdAt.toISOString(),
      read: n.readBy.includes(admin.sub),
    })),
  });
}
