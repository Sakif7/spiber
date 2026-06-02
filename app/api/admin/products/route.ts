import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { productInputSchema } from "@/lib/schemas/catalog";
import { createProduct } from "@/lib/repositories/products.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { slugify } from "@/lib/slug";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);

  const parsed = await parseJson(req, productInputSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const data = {
    ...parsed.data,
    slug: slugify(parsed.data.slug || parsed.data.name.en),
    stockQty: 0,
  };
  try {
    const doc = await createProduct(data);
    await writeAudit({
      actorId: admin.sub,
      action: "product.create",
      entityType: "Product",
      entityId: String(doc._id),
      after: data,
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
