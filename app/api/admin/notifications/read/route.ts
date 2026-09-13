import { z } from "zod";
import { requireStaff } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/rbac";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import {
  markNotificationsRead,
  markAllNotificationsRead,
} from "@/lib/repositories/notifications.repo";

export const dynamic = "force-dynamic";

const readSchema = z.object({
  ids: z
    .array(z.string().regex(/^[0-9a-f]{24}$/i))
    .max(100)
    .optional(),
  all: z.boolean().optional(),
});

/**
 * Mark business notifications read for THIS person (per-admin read state).
 * Mail items in the feed are not rows here — a message reads as unread until
 * it is opened in the mailbox — so their ids are simply not accepted, and an
 * employee (who only ever sees mail) has nothing to mark.
 */
export async function POST(req: Request) {
  const admin = await requireStaff();
  if (!admin) return fail({ code: "forbidden" }, 403);
  if (!isAdmin(admin)) return ok({ done: true });

  const parsed = await parseJson(req, readSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  if (parsed.data.all) {
    await markAllNotificationsRead(admin.sub);
  } else if (parsed.data.ids?.length) {
    await markNotificationsRead(parsed.data.ids, admin.sub);
  }
  return ok({ done: true });
}
