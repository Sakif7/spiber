import { z } from "zod";

export const testimonialToneEnum = z.enum(["teal", "orange", "slate"]);
export const testimonialCategoryEnum = z.enum(["general", "tourism"]);

/**
 * Admin testimonial input. Monolingual (matches the existing testimonials
 * system); `category` separates the homepage pool from the tourism hub pool.
 */
export const testimonialCreateSchema = z.object({
  quote: z.string().trim().min(1, "Quote is required").max(2000),
  name: z.string().trim().min(1, "Name is required").max(120),
  role: z.string().trim().max(160).default(""),
  imageSrc: z.string().trim().max(600).default(""),
  tone: testimonialToneEnum.default("teal"),
  category: testimonialCategoryEnum.default("general"),
  order: z.number().int().min(0).max(9999).default(0),
  published: z.boolean().default(true),
});

export const testimonialUpdateSchema = testimonialCreateSchema.partial();

export type TestimonialCreateInput = z.infer<typeof testimonialCreateSchema>;
export type TestimonialUpdateInput = z.infer<typeof testimonialUpdateSchema>;
