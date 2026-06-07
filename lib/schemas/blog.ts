import { z } from "zod";
import { localizedSchema } from "./localized";

/**
 * Blog content model. Zod is the single source of truth. Post bodies are
 * localized **HTML** authored in TipTap and sanitized server-side on save (and
 * again on render). Scheduling is publish-on-read: a post is visible when
 * status is published/scheduled AND publishedAt ≤ now (no cron needed).
 */

export const blogStatusEnum = z.enum([
  "draft",
  "scheduled",
  "published",
  "archived",
]);
export type BlogStatus = z.infer<typeof blogStatusEnum>;

export const blogSeoSchema = z.object({
  metaTitle: localizedSchema.optional(),
  metaDescription: localizedSchema.optional(),
  ogImage: z.string().optional(),
});

// `slug` optional on input; the route derives it from `title.en` when blank.
// `body` is HTML (sanitized by the API before persisting).
export const blogPostSchema = z
  .object({
    title: localizedSchema,
    slug: z.string().max(200).optional(),
    excerpt: localizedSchema.optional(),
    body: localizedSchema,
    coverImage: z.string().optional(),
    authorName: z.string().max(120).optional(),
    categoryId: z.string().optional(),
    tagIds: z.array(z.string()).default([]),
    status: blogStatusEnum.default("draft"),
    scheduledFor: z.coerce.date().optional(),
    seo: blogSeoSchema.optional(),
  })
  .refine((d) => d.status !== "scheduled" || d.scheduledFor != null, {
    message: "scheduledFor is required when status is 'scheduled'",
    path: ["scheduledFor"],
  });
export type BlogPostInput = z.infer<typeof blogPostSchema>;

export const blogCategorySchema = z.object({
  name: localizedSchema,
  slug: z.string().max(120).optional(),
  description: localizedSchema.optional(),
});
export type BlogCategoryInput = z.infer<typeof blogCategorySchema>;

export const blogTagSchema = z.object({
  name: localizedSchema,
  slug: z.string().max(120).optional(),
});
export type BlogTagInput = z.infer<typeof blogTagSchema>;
