import { createAdminNotification } from "@/lib/repositories/notifications.repo";
import type { IAdminNotification } from "@/lib/models/notification";
import { logger } from "@/lib/log";

export type AdminNotifyInput = Pick<
  IAdminNotification,
  "type" | "title" | "href"
> &
  Partial<Pick<IAdminNotification, "body" | "severity" | "entity">>;

/**
 * Fan a business event out to the admin notification feed (topbar bell).
 * Strictly best-effort: called from inside money/lead flows, so it must never
 * throw — a failed notification write is logged and swallowed, mirroring how
 * the team emails behave (`Promise.allSettled` seams).
 */
export async function notifyAdmins(input: AdminNotifyInput): Promise<void> {
  try {
    await createAdminNotification(input);
  } catch (e) {
    logger.warn(`admin notification failed (${input.type})`, e);
  }
}
