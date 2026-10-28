import { createAdminNotification } from "@/lib/repositories/notifications.repo";
import { superAdminIds } from "@/lib/repositories/users.repo";
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

/**
 * The same, addressed to specific people (an employee's bell shows only
 * rows addressed to them). No-op for an empty list; never throws.
 */
export async function notifyUsers(
  userIds: string[],
  input: AdminNotifyInput,
): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;
  try {
    await createAdminNotification({ ...input, forUserIds: ids });
  } catch (e) {
    logger.warn(`user notification failed (${input.type})`, e);
  }
}

/**
 * The same, for the super admins only — Sales news (a client's invoice, what
 * they paid) must not reach every admin's bell. Never throws.
 */
export async function notifySuperAdmins(
  input: AdminNotifyInput,
): Promise<void> {
  const ids = await superAdminIds().catch((e) => {
    logger.warn(`could not list super admins (${input.type})`, e);
    return [] as string[];
  });
  await notifyUsers(ids, input);
}
