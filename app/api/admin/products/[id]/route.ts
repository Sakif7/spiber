import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { productInputSchema } from "@/lib/schemas/catalog";
import { softDeleteProduct } from "@/lib/repositories/products.repo";
import { updateCatalogProduct } from "@/lib/services/catalog-admin.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;

  const parsed = await parseJson(req, productInputSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  try {
    const doc = await updateCatalogProduct(id, parsed.data, admin.sub);
    if (!doc) return fail({ code: "not_found" }, 404);
    await writeAudit({
      actorId: admin.sub,
      action: "product.update",
      entityType: "Product",
      entityId: id,
      after: { ...parsed.data, storefront: doc.storefront },
    });
    return ok({ id });
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  await softDeleteProduct(id);
  await writeAudit({
    actorId: admin.sub,
    action: "product.delete",
    entityType: "Product",
    entityId: id,
  });
  return ok({ id });
}
