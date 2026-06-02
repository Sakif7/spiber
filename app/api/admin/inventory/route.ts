import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { adjustStockSchema } from "@/lib/schemas/inventory";
import {
  adjustStock,
  InsufficientStockError,
} from "@/lib/services/inventory.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, adjustStockSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  try {
    await adjustStock({ ...parsed.data, createdBy: admin.sub });
    await writeAudit({
      actorId: admin.sub,
      action: "inventory.adjust",
      entityType: "Product",
      entityId: parsed.data.productId,
      after: parsed.data,
    });
    return ok({});
  } catch (e) {
    if (e instanceof InsufficientStockError)
      return fail({ code: "insufficient_stock" }, 409);
    throw e;
  }
}
