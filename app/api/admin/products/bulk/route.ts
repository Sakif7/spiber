import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { productBulkSchema } from "@/lib/schemas/catalog";
import { bulkUpdateProducts } from "@/lib/services/catalog-admin.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

/**
 * Bulk product action (activate / set draft / archive / soft-delete) over many
 * products at once — drives the admin product-list bulk toolbar. Acts on an
 * explicit `ids` list or everything matching the current filter (`all`).
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);

  const parsed = await parseJson(req, productBulkSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const result = await bulkUpdateProducts(parsed.data);

  await writeAudit({
    actorId: admin.sub,
    action: `product.bulk.${parsed.data.action}`,
    entityType: "Product",
    entityId: `bulk:${parsed.data.storefront}`,
    after: {
      action: parsed.data.action,
      storefront: parsed.data.storefront,
      all: parsed.data.all ?? false,
      ...result,
    },
  });

  return ok(result);
}
