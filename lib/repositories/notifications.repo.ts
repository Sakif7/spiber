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
    Partial<Pick<IAdminNotification, "body" | "severity" | "entity">>,
) {
  await connectToDatabase();
  return AdminNotification.create(data);
}

/** Latest notifications for the bell dropdown (newest first). */
export async function listAdminNotifications(limit = 30) {
  await connectToDatabase();
  return AdminNotification.find({})
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, limit)))
    .lean<Lean<IAdminNotification>[]>()
    .exec();
}

export async function countUnreadNotifications(
  userId: string,
): Promise<number> {
  await connectToDatabase();
  return AdminNotification.countDocuments({
    readBy: { $ne: userId },
  } as unknown as NotificationFilter);
}

export async function markNotificationsRead(ids: string[], userId: string) {
  if (ids.length === 0) return;
  await connectToDatabase();
  await AdminNotification.updateMany(
    { _id: { $in: ids } },
    { $addToSet: { readBy: userId } },
  ).exec();
}

export async function markAllNotificationsRead(userId: string) {
  await connectToDatabase();
  await AdminNotification.updateMany(
    { readBy: { $ne: userId } },
    { $addToSet: { readBy: userId } },
  ).exec();
}
