import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { blogPostSchema } from "@/lib/schemas/blog";
import { savePost } from "@/lib/services/blog.service";
import { softDeletePost } from "@/lib/repositories/blog.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { getPostByIdLean } from "@/lib/repositories/blog.repo";
import { postEditInitial } from "@/lib/admin/edit-initial";

/**
 * One post, shaped for the editor.
 *
 * A post's body is far too big to ride along on every row of the list, so the
 * edit panel asks for the record when it opens.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const post = await getPostByIdLean(id).catch(() => null);
  if (!post) return fail({ code: "not_found" }, 404);
  return ok(postEditInitial(post));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, blogPostSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await savePost({
    input: parsed.data,
    authorId: admin.sub,
    id,
  });
  if (!result.ok) {
    if (result.code === "not_found") return fail({ code: "not_found" }, 404);
    return fail({ code: result.code, message: "Slug already exists" }, 409);
  }
  await writeAudit({
    actorId: admin.sub,
    action: "blog_post.update",
    entityType: "BlogPost",
    entityId: id,
    after: { slug: result.slug, status: parsed.data.status },
  });
  return ok({ id: result.id, slug: result.slug });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  await softDeletePost(id);
  await writeAudit({
    actorId: admin.sub,
    action: "blog_post.delete",
    entityType: "BlogPost",
    entityId: id,
  });
  return ok({ id });
}
