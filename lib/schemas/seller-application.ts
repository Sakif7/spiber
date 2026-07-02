import { z } from "zod";
import { bankDetailsSchema } from "./seller";

/**
 * "Become a seller" onboarding application. Submitted by a logged-in user; on
 * approval an admin creates the `Seller` profile and grants the `seller` role.
 * Mirrors the tourism PartnerApplication pipeline (status machine + activity).
 */

export const sellerApplicationStatusEnum = z.enum([
  "new",
  "reviewing",
  "approved",
  "rejected",
]);
export type SellerApplicationStatus = z.infer<
  typeof sellerApplicationStatusEnum
>;

export const SELLER_APP_TRANSITIONS: Record<
  SellerApplicationStatus,
  SellerApplicationStatus[]
> = {
  new: ["reviewing", "rejected"],
  reviewing: ["approved", "rejected"],
  approved: [],
  rejected: ["reviewing"], // allow reopening
};

/** Public submit — AUTH REQUIRED (userId is taken from the session, not input). */
export const sellerApplicationCreateSchema = z.object({
  businessName: z.string().min(1).max(160),
  contactName: z.string().min(1).max(120),
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.email(),
  ),
  phone: z.string().max(40).optional(),
  website: z.string().max(200).optional(),
  address: z.string().max(300).optional(),
  /** What they intend to sell (free text / comma list). */
  categories: z.string().max(300).optional(),
  description: z.string().min(1).max(5000),
  bankDetails: bankDetailsSchema.optional(),
  locale: z.string().max(8).optional(),
});
export type SellerApplicationCreateInput = z.infer<
  typeof sellerApplicationCreateSchema
>;

// ---- Admin actions ----
export const sellerApplicationNoteSchema = z.object({
  body: z.string().min(1).max(5000),
});
export type SellerApplicationNoteInput = z.infer<
  typeof sellerApplicationNoteSchema
>;

export const sellerApplicationAssignSchema = z.object({
  assignedTo: z.string().nullable(),
});
export type SellerApplicationAssignInput = z.infer<
  typeof sellerApplicationAssignSchema
>;

export const sellerApplicationTransitionSchema = z.object({
  to: sellerApplicationStatusEnum,
  note: z.string().max(1000).optional(),
});
export type SellerApplicationTransitionInput = z.infer<
  typeof sellerApplicationTransitionSchema
>;
