import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import {
  softwareProductUpdateSchema,
  type DeliveryType,
} from "@/lib/schemas/systems";
import {
  updateSoftwareProduct,
  softDeleteSoftwareProduct,
} from "@/lib/repositories/software.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { slugify } from "@/lib/slug";

// Delivery fields that must be cleared when they don't apply to the chosen type,
// so switching deliveryType never leaves a stale assetKey / affiliate / externalApp.
const DELIVERY_FIELDS_TO_CLEAR: Record<DeliveryType, string[]> = {
  asset: ["externalApp", "affiliate"],
  license: ["assetKey", "externalApp", "affiliate"],
  external: ["assetKey"],
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, softwareProductUpdateSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const { categoryId, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  // Re-derive slug only when name or slug was provided.
  if (parsed.data.slug || parsed.data.name) {
    data.slug = slugify(parsed.data.slug || parsed.data.name!.en);
  }
  const unset: string[] = [];
  // Empty categoryId clears the field rather than persisting "".
  if (categoryId !== undefined) {
    if (categoryId) data.categoryId = categoryId;
    else unset.push("categoryId");
  }
  // Clear delivery fields irrelevant to the (newly) chosen deliveryType.
  if (parsed.data.deliveryType) {
    for (const f of DELIVERY_FIELDS_TO_CLEAR[parsed.data.deliveryType]) {
      if (data[f] === undefined) unset.push(f);
    }
  }

  try {
    await updateSoftwareProduct(id, data, unset);
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
