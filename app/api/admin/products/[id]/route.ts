import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { productInputSchema } from "@/lib/schemas/catalog";
import {
  updateProduct,
  softDeleteProduct,
} from "@/lib/repositories/products.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { slugify } from "@/lib/slug";

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
  const data = {
    ...parsed.data,
    slug: slugify(parsed.data.slug || parsed.data.name.en),
  };
  const doc = await updateProduct(id, data);
  if (!doc) return fail({ code: "not_found" }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "product.update",
    entityType: "Product",
    entityId: id,
    after: data,
  });
  return ok({ id });
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
