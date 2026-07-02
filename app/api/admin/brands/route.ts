import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { brandSchema } from "@/lib/schemas/catalog";
import { createBrand, listBrands } from "@/lib/repositories/taxonomy.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { slugify } from "@/lib/slug";

/** List all brands (admin) — used by the bulk brand-logo tooling. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const brands = await listBrands();
  return ok({
    brands: brands.map((b) => ({
      id: String(b._id),
      name: b.name,
      slug: b.slug,
      logo: b.logo ?? null,
      position: b.position,
    })),
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, brandSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  const data = {
    ...parsed.data,
    slug: slugify(parsed.data.slug || parsed.data.name.en),
  };
  try {
    const doc = await createBrand(data);
    await writeAudit({
      actorId: admin.sub,
      action: "brand.create",
      entityType: "Brand",
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
      return fail({ code: "duplicate" }, 409);
    }
    throw e;
  }
}
