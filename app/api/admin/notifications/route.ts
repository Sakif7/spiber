import { requireStaff } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/rbac";
import { ok, fail } from "@/lib/http/respond";
import {
  listAdminNotifications,
  countUnreadNotifications,
} from "@/lib/repositories/notifications.repo";
import { mailFeed } from "@/lib/services/mail-notify.service";

export const dynamic = "force-dynamic";

/**
 * The topbar bell feed, polled (~30s): business events for admins (new
 * order, RFQ, lead…) plus unread mail in the mailboxes the person reads as
 * themselves. Employees get the mail part plus rows addressed to them
 * (a document waiting for their signature). Business rows carry
 * per-admin read state; a mail item is "read" once the message is, so it
 * simply stops appearing.
 */
export async function GET(req: Request) {
  const staff = await requireStaff();
  if (!staff) return fail({ code: "forbidden" }, 403);
  const admin = isAdmin(staff);
  // The bell shows the latest 30 from a short cache; the notifications
  // page asks for more and for a fresh read of the mailboxes.
  const params = new URL(req.url).searchParams;
  const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 30));
  const fresh = params.get("fresh") === "1";

  // Admins see the business rows plus anything addressed to them; an
  // employee sees only rows addressed to them (a document to sign).
  const viewer = { userId: staff.sub, admin };
  const [items, unread, mail] = await Promise.all([
    listAdminNotifications(limit, viewer),
    countUnreadNotifications(staff.sub, admin),
    mailFeed(staff, { fresh }),
  ]);

  const feed = [
    ...items.map((n) => ({
      id: String(n._id),
      kind: "event" as const,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      href: n.href,
      severity: n.severity ?? "info",
      entityRef: n.entity?.ref ?? null,
      createdAt: n.createdAt.toISOString(),
      read: n.readBy.includes(staff.sub),
    })),
    ...mail.items.map((m) => ({
      id: m.id,
      kind: "mail" as const,
      type: "mail.received",
      title: `New mail from ${m.from}`,
      body: m.subject,
      href: m.href,
      severity: "info" as const,
      entityRef: m.address,
      createdAt: m.date,
      read: false,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return ok({
    unread: unread + mail.unread,
    unreadMail: mail.unread,
    items: feed,
  });
}
