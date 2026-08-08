import { z } from "zod";

/**
 * A `Seller` is an APPROVED vendor profile (created when a SellerApplication is
 * approved). It owns marketplace products (`Product.sellerId`) and accrues
 * commissions/payouts. Distinct from the application (the onboarding lead).
 */

export const sellerStatusEnum = z.enum(["active", "suspended"]);
export type SellerStatus = z.infer<typeof sellerStatusEnum>;

/** Payout bank details (BDT). Optional at every field so partial edits work. */
export const bankDetailsSchema = z.object({
  accountName: z.string().max(160).optional(),
  bankName: z.string().max(160).optional(),
  accountNumber: z.string().max(60).optional(),
  branch: z.string().max(160).optional(),
  routingNumber: z.string().max(60).optional(),
  mobileWallet: z.string().max(60).optional(),
});
export type BankDetailsInput = z.infer<typeof bankDetailsSchema>;

/** Seller-editable profile fields (seller portal). */
export const sellerProfileUpdateSchema = z.object({
  displayName: z.string().min(1).max(160).optional(),
  bio: z.string().max(2000).optional(),
  logo: z.string().optional(),
  bankDetails: bankDetailsSchema.optional(),
});
export type SellerProfileUpdateInput = z.infer<
  typeof sellerProfileUpdateSchema
>;

/** Admin: per-seller commission override (basis points; null → global default). */
export const sellerCommissionUpdateSchema = z.object({
  commissionBp: z.number().int().min(0).max(10000).nullable(),
});
export type SellerCommissionUpdateInput = z.infer<
  typeof sellerCommissionUpdateSchema
>;

/** Admin: suspend / reactivate a seller. */
export const sellerStatusUpdateSchema = z.object({
  status: sellerStatusEnum,
});
export type SellerStatusUpdateInput = z.infer<typeof sellerStatusUpdateSchema>;

/** Admin: set the GLOBAL default commission rate (basis points). */
export const globalCommissionSchema = z.object({
  commissionBp: z.number().int().min(0).max(10000),
});
export type GlobalCommissionInput = z.infer<typeof globalCommissionSchema>;

/**
 * Admin: seller-commission settings — the global default and/or per-category
 * rates (bp; null clears a category back to inherit). One POST saves both.
 */
export const sellerSettingsUpdateSchema = z.object({
  commissionBp: z.number().int().min(0).max(10000).optional(),
  categoryRates: z
    .array(
      z.object({
        categoryId: z.string().min(1),
        commissionBp: z.number().int().min(0).max(10000).nullable(),
      }),
    )
    .max(300)
    .optional(),
});
export type SellerSettingsUpdateInput = z.infer<
  typeof sellerSettingsUpdateSchema
>;
