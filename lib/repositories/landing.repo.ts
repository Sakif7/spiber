import { connectToDatabase } from "@/lib/db/connect";
import { Testimonial } from "@/lib/models/testimonial";
import { Post } from "@/lib/models/post";
import type {
  Testimonial as TestimonialView,
  Post as PostView,
} from "@/lib/content-types";

/**
 * Read access for landing-page content. These throw on DB failure; the service
 * layer decides on the graceful fallback.
 */

export async function findTestimonials(limit = 20): Promise<TestimonialView[]> {
  await connectToDatabase();
  const docs = await Testimonial.find({}, { _id: 0 })
    .sort({ order: 1 })
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
