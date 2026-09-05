import { connectToDatabase } from "@/lib/db/connect";
import { BlogPost, type IBlogPost } from "@/lib/models/blogPost";
import type { Lean } from "@/lib/models/_shared";
import type { BlogStatus } from "@/lib/schemas/blog";
import { applyPartialSearch } from "@/lib/repositories/search-filter";
import {
  applyDateRange,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

type BlogFilter = NonNullable<Parameters<typeof BlogPost.countDocuments>[0]>;

/** Public-visibility predicate: published/scheduled and live (publishedAt ≤ now). */
function visibleQuery(now: Date): Record<string, unknown> {
  return {
    deletedAt: null,
    status: { $in: ["published", "scheduled"] },
    publishedAt: { $ne: null, $lte: now },
  };
}

export type PublicPostListParams = {
  categoryId?: string;
  tagId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function listPublishedPosts(params: PublicPostListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = visibleQuery(new Date());
  if (params.categoryId) q.categoryId = params.categoryId;
  if (params.tagId) q.tagIds = params.tagId;
  applyPartialSearch(q, params.search, [
    "title.en",
    "title.bn",
    "excerpt.en",
    "excerpt.bn",
  ]);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, params.pageSize ?? 9));
  const filter = q as unknown as BlogFilter;
  const [items, total] = await Promise.all([
    BlogPost.find(filter)
      .sort({ publishedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IBlogPost>[]>()
      .exec(),
    BlogPost.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getPublishedPostBySlug(slug: string) {
  await connectToDatabase();
  return BlogPost.findOne({ slug, ...visibleQuery(new Date()) })
    .lean<Lean<IBlogPost>>()
    .exec();
}

export async function listRelatedPosts(
  categoryId: string | null | undefined,
  excludeId: string,
  limit = 3,
) {
  await connectToDatabase();
  const q: Record<string, unknown> = {
    ...visibleQuery(new Date()),
    _id: { $ne: excludeId },
  };
  if (categoryId) q.categoryId = categoryId;
  return BlogPost.find(q as unknown as BlogFilter)
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean<Lean<IBlogPost>[]>()
    .exec();
}

/** Visible posts for the sitemap / RSS feed. */
export async function listVisiblePostsForFeed(limit = 50) {
  await connectToDatabase();
  return BlogPost.find(visibleQuery(new Date()) as unknown as BlogFilter)
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean<Lean<IBlogPost>[]>()
    .exec();
}

// ---- Admin ----
/** Sort keys the admin list exposes → stored fields. */
const ADMIN_POST_SORT: Record<string, string> = {
  date: "createdAt",
  title: "title.en",
  status: "status",
  published: "publishedAt",
  views: "viewCount",
};

export type AdminPostListParams = RepoListQuery & {
  status?: BlogStatus;
};

export async function listAdminPosts(params: AdminPostListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  applyPartialSearch(q, params.search, ["title.en", "title.bn", "excerpt.en"]);
  applyDateRange(q, params.from, params.to);
  return paginate<IBlogPost>(BlogPost, q, {
    sort: sortSpec(params.sort, params.dir, ADMIN_POST_SORT),
    page: params.page,
    pageSize: params.pageSize ?? 50,
  });
}

export async function getPostById(id: string) {
  await connectToDatabase();
  return BlogPost.findOne({ _id: id, deletedAt: null }).exec();
}

export async function getPostByIdLean(id: string) {
  await connectToDatabase();
  return BlogPost.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IBlogPost>>()
    .exec();
}

export async function createPost(data: Partial<IBlogPost>) {
  await connectToDatabase();
  return BlogPost.create(data);
}

export async function updatePost(id: string, data: Partial<IBlogPost>) {
  await connectToDatabase();
  return BlogPost.findByIdAndUpdate(id, data, { new: true }).exec();
}

export async function softDeletePost(id: string) {
  await connectToDatabase();
  await BlogPost.updateOne(
    { _id: id },
    { $set: { deletedAt: new Date(), status: "archived" } },
  ).exec();
}

export async function incrementViewCount(id: string) {
  await connectToDatabase();
  await BlogPost.updateOne({ _id: id }, { $inc: { viewCount: 1 } }).exec();
}
