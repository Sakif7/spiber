import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { productInputSchema } from "@/lib/schemas/catalog";
import { createCatalogProduct } from "@/lib/services/catalog-admin.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);

  const parsed = await parseJson(req, productInputSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  try {
    const doc = await createCatalogProduct(parsed.data, admin.sub);
    await writeAudit({
      actorId: admin.sub,
      action: "product.create",
      entityType: "Product",
      entityId: String(doc._id),
      after: { ...parsed.data, storefront: doc.storefront },
    });
    return ok({ id: String(doc._id) });
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e &&
      "code" in e &&
      (e as { code?: number }).code === 11000
    ) {
      return fail(
        { code: "duplicate", message: "SKU or slug already exists" },
        409,
      );
    }
    throw e;
  }
}
