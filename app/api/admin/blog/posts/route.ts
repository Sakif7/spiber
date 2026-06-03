import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { blogPostSchema } from "@/lib/schemas/blog";
import { savePost } from "@/lib/services/blog.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, blogPostSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await savePost({ input: parsed.data, authorId: admin.sub });
  if (!result.ok) {
    return fail({ code: result.code, message: "Slug already exists" }, 409);
  }
  await writeAudit({
    actorId: admin.sub,
    action: "blog_post.create",
    entityType: "BlogPost",
    entityId: result.id,
    after: { slug: result.slug, status: parsed.data.status },
  });
  return ok({ id: result.id, slug: result.slug });
}
