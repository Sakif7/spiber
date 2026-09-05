import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { setStockSchema } from "@/lib/schemas/inventory";
import { adminSetStock } from "@/lib/services/inventory.service";
import { inventoryErrorResponse } from "@/lib/http/inventory-error";
import { writeAudit } from "@/lib/repositories/audit.repo";

/** "Set to N" — the service applies the difference atomically. */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, setStockSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  try {
    const res = await adminSetStock({ ...parsed.data, createdBy: admin.sub });
    if (res.changed) {
      await writeAudit({
        actorId: admin.sub,
        action: res.overridden ? "inventory.override" : "inventory.set",
        entityType: "Product",
        entityId: parsed.data.productId,
        after: { ...parsed.data, stockAfter: res.stockAfter },
      });
    }
    return ok({
      stockAfter: res.stockAfter,
      changed: res.changed,
      overridden: res.overridden,
    });
  } catch (e) {
    const mapped = inventoryErrorResponse(e);
    if (mapped) return mapped;
    throw e;
  }
}
