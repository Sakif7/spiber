import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { brandReorderSchema } from "@/lib/schemas/catalog";
import { reorderBrands } from "@/lib/repositories/taxonomy.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, brandReorderSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  await reorderBrands(parsed.data.updates);
  await writeAudit({
    actorId: admin.sub,
    action: "brand.reorder",
    entityType: "Brand",
    entityId: "list",
    after: { count: parsed.data.updates.length },
  });
  return ok({ updated: parsed.data.updates.length });
}
