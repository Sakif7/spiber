import { z } from "zod";

/** Marketplace product reviews (sign-in required; admin-moderated). */

export const reviewStatusEnum = z.enum(["pending", "approved", "rejected"]);
export type ReviewStatus = z.infer<typeof reviewStatusEnum>;

export const reviewCreateSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(140).optional(),
  body: z.string().min(1).max(4000),
});
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;

export const reviewModerateSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});
export type ReviewModerateInput = z.infer<typeof reviewModerateSchema>;
