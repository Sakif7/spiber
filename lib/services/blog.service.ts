import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { type IBlogPost } from "@/lib/models/blogPost";
import {
  createPost,
  updatePost,
  getPostByIdLean,
} from "@/lib/repositories/blog.repo";
import { sanitizeRichHtml } from "@/lib/sanitize";
import { readingTimeMin, excerptFromHtml } from "@/lib/reading-time";
import { slugify } from "@/lib/slug";
import type { BlogPostInput } from "@/lib/schemas/blog";

export type SavePostResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; code: "duplicate" | "not_found" };

/**
 * Create or update a post. Sanitizes the localized HTML body, derives reading
 * time + excerpt, and sets `publishedAt` from status (publish-on-read): published
 * → now (preserving the original date on edit); scheduled → `scheduledFor`;
 * draft/archived → null (hidden).
 */
export async function savePost(args: {
  input: BlogPostInput;
  authorId: string;
  id?: string;
}): Promise<SavePostResult> {
  await connectToDatabase();
  const { input } = args;
  const now = new Date();

  const existing = args.id ? await getPostByIdLean(args.id) : null;

  const body = {
    en: sanitizeRichHtml(input.body.en),
    bn: input.body.bn ? sanitizeRichHtml(input.body.bn) : undefined,
  };

  let publishedAt: Date | null = null;
  if (input.status === "published") {
    // Preserve the original publish date ONLY if the post was already public
    // (a past publishedAt). A scheduled post being published now carries a
    // FUTURE publishedAt which must be reset to now, or it would stay hidden.
    const prev = existing?.publishedAt ? new Date(existing.publishedAt) : null;
    publishedAt = prev && prev <= now ? prev : now;
  } else if (input.status === "scheduled") {
    publishedAt = input.scheduledFor ?? now;
  }

  const excerpt =
    input.excerpt && input.excerpt.en
      ? input.excerpt
      : {
          en: excerptFromHtml(body.en),
          bn: body.bn ? excerptFromHtml(body.bn) : undefined,
        };

  const data: Partial<IBlogPost> = {
    title: input.title,
    slug: slugify(input.slug || input.title.en),
    excerpt,
    body,
    coverImage: input.coverImage || undefined,
    // Display byline; stored as "" when blank so editing can clear it.
    authorName: (input.authorName ?? "").trim(),
    categoryId: input.categoryId
      ? new mongoose.Types.ObjectId(input.categoryId)
      : null,
    tagIds: (input.tagIds ?? []).map((t) => new mongoose.Types.ObjectId(t)),
    status: input.status,
    publishedAt,
    scheduledFor: input.scheduledFor ?? null,
    readingTimeMin: readingTimeMin(body.en || body.bn || ""),
    seo: input.seo,
  };
  // Set the owning account only on create — editing (incl. published posts)
  // must NOT reassign authorship to whoever made the edit.
  if (!existing) {
    data.authorId = new mongoose.Types.ObjectId(args.authorId);
  }

  try {
    if (args.id) {
      const updated = await updatePost(args.id, data);
      if (!updated) return { ok: false, code: "not_found" };
      return { ok: true, id: args.id, slug: updated.slug };
    }
    const created = await createPost(data);
    return { ok: true, id: String(created._id), slug: created.slug };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err &&
      "code" in err &&
      (err as { code?: number }).code === 11000
    ) {
      return { ok: false, code: "duplicate" };
    }
    throw err;
  }
}
