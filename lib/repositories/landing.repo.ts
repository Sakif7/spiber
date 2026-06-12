import { connectToDatabase } from "@/lib/db/connect";
import {
  Testimonial,
  type TestimonialCategory,
} from "@/lib/models/testimonial";
import { Post } from "@/lib/models/post";
import type {
  Testimonial as TestimonialView,
  Post as PostView,
} from "@/lib/content-types";

/**
 * Read access for landing-page content. These throw on DB failure; the service
 * layer decides on the graceful fallback.
 */

export async function findTestimonials({
  category,
  limit = 20,
}: {
  category?: TestimonialCategory;
  limit?: number;
} = {}): Promise<TestimonialView[]> {
  await connectToDatabase();
  // Legacy-safe: `deletedAt: null` and `published: { $ne: false }` also match
  // documents missing those fields (pre-existing seed rows). For "general",
  // anything that isn't explicitly "tourism" counts (legacy rows had no
  // category).
  const filter: Record<string, unknown> = {
    deletedAt: null,
    published: { $ne: false },
  };
  if (category === "tourism") filter.category = "tourism";
  else if (category === "general") filter.category = { $ne: "tourism" };

  const docs = await Testimonial.find(filter, {
    _id: 0,
    quote: 1,
    name: 1,
    role: 1,
    tone: 1,
    imageSrc: 1,
  })
    .sort({ order: 1, createdAt: 1 })
    .limit(limit)
    .lean<TestimonialView[]>()
    .exec();
  return docs;
}

export async function findLatestPosts(limit = 6): Promise<PostView[]> {
  await connectToDatabase();
  const docs = await Post.find({}, { _id: 0 })
    .sort({ date: -1 })
    .limit(limit)
    .lean<PostView[]>()
    .exec();
  return docs;
}
