import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { trackStockSchema } from "@/lib/schemas/inventory";
import { setTrackStock } from "@/lib/services/inventory.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

/** Force stock tracking on/off for a product (null = default rule). */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, trackStockSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  const found = await setTrackStock(
    parsed.data.productId,
    parsed.data.trackStock,
  );
  if (!found) return fail({ code: "not_found" }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "inventory.track",
    entityType: "Product",
    entityId: parsed.data.productId,
    after: { trackStock: parsed.data.trackStock },
  });
  return ok({ trackStock: parsed.data.trackStock });
}
