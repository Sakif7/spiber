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

/** KYC document kinds collected at signup. Required set enforced below. */
export const SELLER_DOC_TYPES = [
  "trade_license",
  "national_id",
  "tin_certificate",
  "bank_statement",
] as const;
export const REQUIRED_SELLER_DOCS: readonly string[] = [
  "trade_license",
  "national_id",
];

export const sellerAppDocumentSchema = z.object({
  label: z.enum(SELLER_DOC_TYPES),
  /** PRIVATE storage key returned by /api/seller/apply/uploads. */
  key: z.string().min(1).max(512),
  filename: z.string().min(1).max(200),
  size: z.number().int().min(0).optional(),
  mime: z.string().max(120).optional(),
});
export type SellerAppDocumentInput = z.infer<typeof sellerAppDocumentSchema>;

/** Public submit — AUTH REQUIRED (userId is taken from the session, not input). */
export const sellerApplicationCreateSchema = z
  .object({
    businessName: z.string().min(1).max(160),
    contactName: z.string().min(1).max(120),
    email: z.preprocess(
      (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
      z.email(),
    ),
    phone: z.string().min(6).max(40),
    website: z.string().max(200).optional(),
    address: z.string().max(300).optional(),
    /** What they intend to sell (free text / comma list). */
    categories: z.string().max(300).optional(),
    description: z.string().min(1).max(5000),
    bankDetails: bankDetailsSchema.optional(),
    /** Verification documents — trade license + NID are mandatory. */
    documents: z.array(sellerAppDocumentSchema).max(8).default([]),
    /** Must be true — the applicant accepts the seller terms. */
    termsAccepted: z.literal(true),
    locale: z.string().max(8).optional(),
  })
  .superRefine((val, ctx) => {
    const labels = new Set<string>(val.documents.map((d) => d.label));
    for (const required of REQUIRED_SELLER_DOCS) {
      if (!labels.has(required)) {
        ctx.addIssue({
          code: "custom",
          path: ["documents"],
          message: `missing_required_document:${required}`,
        });
      }
    }
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
