import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { categoryReorderSchema } from "@/lib/schemas/catalog";
import { reorderCategories } from "@/lib/repositories/taxonomy.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, categoryReorderSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  await reorderCategories(parsed.data.updates);
  await writeAudit({
    actorId: admin.sub,
    action: "category.reorder",
    entityType: "Category",
    entityId: "tree",
    after: { count: parsed.data.updates.length },
  });
  return ok({ updated: parsed.data.updates.length });
}
