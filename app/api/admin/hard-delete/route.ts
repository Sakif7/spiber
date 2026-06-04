import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/repositories/audit.repo";
import {
  isDeletable,
  listRecent,
  hardDeleteOne,
  purgeCollection,
} from "@/lib/services/hard-delete.service";

export const dynamic = "force-dynamic";

// Browse recent rows of a collection (for the Maintenance UI).
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const url = new URL(req.url);
  const collection = url.searchParams.get("collection") ?? "";
  if (!isDeletable(collection)) return fail({ code: "bad_collection" }, 400);
  const limit = Number(url.searchParams.get("limit") ?? "25");
  return ok({ items: await listRecent(collection, limit) });
}

const deleteSchema = z.union([
  z.object({ collection: z.string().min(1), id: z.string().min(1) }),
  z.object({
    collection: z.string().min(1),
    purge: z.literal(true),
    confirm: z.string(),
    softOnly: z.boolean().optional(),
  }),
]);

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, deleteSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const data = parsed.data;

  // ---- Purge an entire collection (type-to-confirm) ----
  if ("purge" in data) {
    if (data.confirm !== data.collection) {
      return fail({ code: "confirm_mismatch" }, 400);
    }
    const res = await purgeCollection(data.collection, data.softOnly ?? false);
    if (!res.ok) return fail({ code: res.code }, 400);
    await writeAudit({
      actorId: admin.sub,
      action: data.softOnly ? "hard_purge_soft_deleted" : "hard_purge",
      entityType: data.collection,
      entityId: "ALL",
      after: { deletedCount: res.deletedCount },
    });
    return ok({ deletedCount: res.deletedCount });
  }

  // ---- Delete a single record ----
  const res = await hardDeleteOne(data.collection, data.id);
  if (!res.ok) {
    return fail({ code: res.code }, res.code === "not_found" ? 404 : 400);
  }
  await writeAudit({
    actorId: admin.sub,
    action: "hard_delete",
    entityType: data.collection,
    entityId: data.id,
    before: res.before,
  });
  return ok({ deletedCount: res.deletedCount });
}
