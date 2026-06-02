import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { categorySchema } from "@/lib/schemas/catalog";
import { createCategory } from "@/lib/repositories/taxonomy.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { slugify } from "@/lib/slug";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, categorySchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  const data = {
    ...parsed.data,
    slug: slugify(parsed.data.slug || parsed.data.name.en),
  };
  try {
    const doc = await createCategory(data);
    await writeAudit({
      actorId: admin.sub,
      action: "category.create",
      entityType: "Category",
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
