import {
  findTestimonials,
  findLatestPosts,
} from "@/lib/repositories/landing.repo";
import type { TestimonialCategory } from "@/lib/models/testimonial";
import { logger } from "@/lib/log";
import type { Testimonial, Post } from "@/lib/content-types";

/**
 * Landing content reads degrade gracefully: if the DB is unavailable the
 * marketing page still renders (empty list → baked-in / "Coming soon" UI).
 */

export async function getTestimonials(
  category?: TestimonialCategory,
): Promise<Testimonial[]> {
  try {
    return await findTestimonials({ category });
  } catch (err) {
    logger.warn("landing.getTestimonials failed; returning empty", err);
    return [];
  }
}

export async function getLatestPosts(limit = 6): Promise<Post[]> {
  try {
    return await findLatestPosts(limit);
  } catch (err) {
    logger.warn("landing.getLatestPosts failed; returning empty", err);
    return [];
  }
}
