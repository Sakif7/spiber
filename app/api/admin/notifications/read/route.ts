import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guard";
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

/** Mark notifications read for THIS admin (per-admin read state). */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);

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
