import { z } from "zod";
import { requireStaff } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/rbac";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import {
  markNotificationsRead,
  markAllNotificationsRead,
} from "@/lib/repositories/notifications.repo";
import { markMailRead } from "@/lib/services/mail-notify.service";

export const dynamic = "force-dynamic";

const ROW_ID = /^[0-9a-f]{24}$/i;
const MAIL_ID = /^mail:[^:]+:.+:\d+$/;

const readSchema = z.object({
  ids: z
    .array(
      z
        .string()
        .max(300)
        .refine((s) => ROW_ID.test(s) || MAIL_ID.test(s)),
    )
    .max(100)
    .optional(),
  all: z.boolean().optional(),
});

/**
 * Mark notifications read for THIS person: business rows get per-admin read
 * state; a mail item is marked \\Seen in its mailbox (the same thing opening
 * it does). "All" covers both — every business row for an admin, and every
 * message the bell currently lists for anyone.
 */
export async function POST(req: Request) {
  const staff = await requireStaff();
  if (!staff) return fail({ code: "forbidden" }, 403);
  const admin = isAdmin(staff);

  const parsed = await parseJson(req, readSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  let mail = 0;
  if (parsed.data.all) {
    if (admin) await markAllNotificationsRead(staff.sub);
    mail = await markMailRead(staff);
  } else if (parsed.data.ids?.length) {
    const rows = parsed.data.ids.filter((id) => ROW_ID.test(id));
    const mailIds = parsed.data.ids.filter((id) => MAIL_ID.test(id));
    if (admin && rows.length) await markNotificationsRead(rows, staff.sub);
    if (mailIds.length) mail = await markMailRead(staff, mailIds);
  }
  return ok({ done: true, mail });
}
