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
 * themselves. Employees get only the mail part. Business rows carry
 * per-admin read state; a mail item is "read" once the message is, so it
 * simply stops appearing.
 */
export async function GET() {
  const staff = await requireStaff();
  if (!staff) return fail({ code: "forbidden" }, 403);
  const admin = isAdmin(staff);

  const [items, unread, mail] = await Promise.all([
    admin ? listAdminNotifications(30) : Promise.resolve([]),
    admin ? countUnreadNotifications(staff.sub) : Promise.resolve(0),
    mailFeed(staff),
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
