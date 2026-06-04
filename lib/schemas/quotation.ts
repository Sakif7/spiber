import { z } from "zod";

/**
 * Instruments quotation (request-for-quote) pipeline. A buyer adds one or more
 * Instruments products to a quote list, then submits a single QuotationRequest
 * (guest or signed-in). Staff respond with a quoted price/validity/PDF and move
 * it through the sales pipeline. Modeled on the generalized Inquiry pipeline.
 */

export const quotationStatusEnum = z.enum([
  "new",
  "quoted",
  "negotiating",
  "won",
  "lost",
]);
export type QuotationStatus = z.infer<typeof quotationStatusEnum>;

/** Allowed status transitions enforced by the quotation service. */
export const QUOTATION_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> =
  {
    new: ["quoted", "lost"],
    quoted: ["negotiating", "won", "lost"],
    negotiating: ["won", "lost"],
    won: [],
    lost: ["negotiating"], // allow reopening a lost quote
  };

export const quotationItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).nullable().optional(),
  quantity: z.number().int().positive().max(99999),
});
export type QuotationItemInput = z.infer<typeof quotationItemSchema>;

/**
 * Public submit (rate-limited). Contact fields are auto-filled for signed-in
 * users by the route; guests provide them. The route fills `requesterId`.
 */
export const quotationCreateSchema = z.object({
  contact: z.object({
    name: z.string().min(1).max(120),
    email: z.preprocess(
      (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
      z.email(),
    ),
    organization: z.string().max(160).optional(),
    phone: z.string().max(40).optional(),
  }),
  items: z.array(quotationItemSchema).min(1).max(100),
  deliveryLocation: z.object({
    district: z.string().min(1).max(100),
    city: z.string().max(100).optional(),
  }),
  timeline: z.string().max(120).optional(),
  notes: z.string().max(5000).optional(),
});
export type QuotationCreateInput = z.infer<typeof quotationCreateSchema>;

// ---- Admin actions ----
export const quotationNoteSchema = z.object({
  body: z.string().min(1).max(5000),
});
export type QuotationNoteInput = z.infer<typeof quotationNoteSchema>;

export const quotationAssignSchema = z.object({
  assignedTo: z.string().nullable(),
});
export type QuotationAssignInput = z.infer<typeof quotationAssignSchema>;

export const quotationTransitionSchema = z.object({
  to: quotationStatusEnum,
  note: z.string().max(1000).optional(),
});
export type QuotationTransitionInput = z.infer<
  typeof quotationTransitionSchema
>;

/** Staff enters a quoted price / validity / attached PDF. */
export const quotationQuoteSchema = z.object({
  amountMinor: z.number().int().nonnegative().optional(),
  validUntil: z.coerce.date().optional(),
  fileKey: z.string().max(512).optional(),
  note: z.string().max(2000).optional(),
});
export type QuotationQuoteInput = z.infer<typeof quotationQuoteSchema>;
