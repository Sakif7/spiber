import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { adjustStockSchema } from "@/lib/schemas/inventory";
import { adminAdjustStock } from "@/lib/services/inventory.service";
import { inventoryErrorResponse } from "@/lib/http/inventory-error";
import { writeAudit } from "@/lib/repositories/audit.repo";

/** Adjust one stock unit by a delta (receive, write-off, correction). */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, adjustStockSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  try {
    const res = await adminAdjustStock({
      ...parsed.data,
      createdBy: admin.sub,
    });
    await writeAudit({
      actorId: admin.sub,
      action: res.overridden ? "inventory.override" : "inventory.adjust",
      entityType: "Product",
      entityId: parsed.data.productId,
      after: { ...parsed.data, stockAfter: res.stockAfter },
    });
    return ok({ stockAfter: res.stockAfter, overridden: res.overridden });
  } catch (e) {
    const mapped = inventoryErrorResponse(e);
    if (mapped) return mapped;
    throw e;
  }
}
