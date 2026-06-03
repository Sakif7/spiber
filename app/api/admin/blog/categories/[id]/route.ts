import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { blogCategorySchema } from "@/lib/schemas/blog";
import {
  updateBlogCategory,
  softDeleteBlogCategory,
} from "@/lib/repositories/blogTaxonomy.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { slugify } from "@/lib/slug";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, blogCategorySchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  const data = {
    ...parsed.data,
    slug: slugify(parsed.data.slug || parsed.data.name.en),
  };
  await updateBlogCategory(id, data);
  await writeAudit({
    actorId: admin.sub,
    action: "blog_category.update",
    entityType: "BlogCategory",
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
  await softDeleteBlogCategory(id);
  await writeAudit({
    actorId: admin.sub,
    action: "blog_category.delete",
    entityType: "BlogCategory",
    entityId: id,
  });
  return ok({ id });
}
