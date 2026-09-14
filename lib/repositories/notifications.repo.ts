import { connectToDatabase } from "@/lib/db/connect";
import {
  AdminNotification,
  type IAdminNotification,
} from "@/lib/models/notification";
import type { Lean } from "@/lib/models/_shared";

type NotificationFilter = NonNullable<
  Parameters<typeof AdminNotification.countDocuments>[0]
>;

export async function createAdminNotification(
  data: Pick<IAdminNotification, "type" | "title" | "href"> &
    Partial<
      Pick<IAdminNotification, "body" | "severity" | "entity" | "forUserIds">
    >,
) {
  await connectToDatabase();
  return AdminNotification.create(data);
}

/**
 * Whose rows a person sees: an admin gets every global row plus anything
 * addressed to them; an employee only what is addressed to them.
 */
export type NotificationViewer = { userId: string; admin: boolean };

function visibleTo(v: NotificationViewer): NotificationFilter {
  const mine = { forUserIds: v.userId };
  if (!v.admin) return mine as unknown as NotificationFilter;
  return {
    $or: [
      { forUserIds: { $exists: false } },
      { forUserIds: { $size: 0 } },
      mine,
    ],
  } as unknown as NotificationFilter;
}

/** Latest notifications for the bell dropdown (newest first). */
export async function listAdminNotifications(
  limit = 30,
  viewer: NotificationViewer = { userId: "", admin: true },
) {
  await connectToDatabase();
  return AdminNotification.find(visibleTo(viewer))
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, limit)))
    .lean<Lean<IAdminNotification>[]>()
    .exec();
}

export async function countUnreadNotifications(
  userId: string,
  admin = true,
): Promise<number> {
  await connectToDatabase();
  return AdminNotification.countDocuments({
    $and: [visibleTo({ userId, admin }), { readBy: { $ne: userId } }],
  } as unknown as NotificationFilter);
}

export async function markNotificationsRead(
  ids: string[],
  userId: string,
  admin = true,
) {
  if (ids.length === 0) return;
  await connectToDatabase();
  await AdminNotification.updateMany(
    {
      $and: [visibleTo({ userId, admin }), { _id: { $in: ids } }],
    } as unknown as NotificationFilter,
    { $addToSet: { readBy: userId } },
  ).exec();
}

export async function markAllNotificationsRead(userId: string, admin = true) {
  await connectToDatabase();
  await AdminNotification.updateMany(
    {
      $and: [visibleTo({ userId, admin }), { readBy: { $ne: userId } }],
    } as unknown as NotificationFilter,
    { $addToSet: { readBy: userId } },
  ).exec();
}
