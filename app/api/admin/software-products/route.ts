import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { softwareProductSchema } from "@/lib/schemas/systems";
import { createSoftwareProduct } from "@/lib/repositories/software.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { slugify } from "@/lib/slug";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, softwareProductSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  const data = {
    ...parsed.data,
    slug: slugify(parsed.data.slug || parsed.data.name.en),
    categoryId: parsed.data.categoryId || undefined,
  };
  try {
    const doc = await createSoftwareProduct(data);
    await writeAudit({
      actorId: admin.sub,
      action: "software_product.create",
      entityType: "SoftwareProduct",
      entityId: String(doc._id),
      after: { slug: data.slug, status: data.status },
    });
    return ok({ id: String(doc._id) });
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e &&
      "code" in e &&
      (e as { code?: number }).code === 11000
    ) {
      return fail({ code: "duplicate", message: "Slug already exists" }, 409);
    }
    throw e;
  }
}
