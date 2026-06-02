import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { softwareProductSchema } from "@/lib/schemas/systems";
import {
  updateSoftwareProduct,
  softDeleteSoftwareProduct,
} from "@/lib/repositories/software.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { slugify } from "@/lib/slug";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, softwareProductSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  const data = {
    ...parsed.data,
    slug: slugify(parsed.data.slug || parsed.data.name.en),
    categoryId: parsed.data.categoryId || undefined,
  };
  try {
    await updateSoftwareProduct(id, data);
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
  await writeAudit({
    actorId: admin.sub,
    action: "software_product.update",
    entityType: "SoftwareProduct",
    entityId: id,
    after: { slug: data.slug, status: data.status },
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
  await softDeleteSoftwareProduct(id);
  await writeAudit({
    actorId: admin.sub,
    action: "software_product.delete",
    entityType: "SoftwareProduct",
    entityId: id,
  });
  return ok({ id });
}
