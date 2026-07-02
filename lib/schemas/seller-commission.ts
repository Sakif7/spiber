import { z } from "zod";

/** Seller commission + payout ledger enums and admin payloads. */

export const sellerCommissionStatusEnum = z.enum(["accrued", "paid", "void"]);
export type SellerCommissionStatus = z.infer<typeof sellerCommissionStatusEnum>;

export const sellerPayoutStatusEnum = z.enum([
  "pending",
  "processing",
  "paid",
  "failed",
]);
export type SellerPayoutStatus = z.infer<typeof sellerPayoutStatusEnum>;

/** Admin: create a payout for a seller from a set of accrued commissions. */
export const sellerPayoutCreateSchema = z.object({
  sellerId: z.string().min(1),
  commissionIds: z.array(z.string().min(1)).min(1).max(1000),
  note: z.string().max(1000).optional(),
});
export type SellerPayoutCreateInput = z.infer<typeof sellerPayoutCreateSchema>;

export const sellerPayoutStatusUpdateSchema = z.object({
  status: sellerPayoutStatusEnum,
  note: z.string().max(1000).optional(),
});
export type SellerPayoutStatusUpdateInput = z.infer<
  typeof sellerPayoutStatusUpdateSchema
>;
