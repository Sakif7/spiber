import { z } from "zod";

/**
 * "Request a product" — a customer asks Spiber Kart to source an item that isn't
 * currently in the catalogue. A lightweight lead pipeline (mirrors Inquiry):
 * public submit → team email + auto-ack → admin sourcing workflow. Distinct from
 * the Medtrade RFQ `Quotation` (which quotes EXISTING listed products).
 */

export const productRequestStatusEnum = z.enum([
  "new",
  "reviewing",
  "sourcing",
  "quoted",
  "fulfilled",
  "declined",
]);
export type ProductRequestStatus = z.infer<typeof productRequestStatusEnum>;

/** Allowed status transitions enforced by the service. */
export const PRODUCT_REQUEST_TRANSITIONS: Record<
  ProductRequestStatus,
  ProductRequestStatus[]
> = {
  new: ["reviewing", "declined"],
  reviewing: ["sourcing", "quoted", "declined"],
  sourcing: ["quoted", "declined"],
  quoted: ["fulfilled", "declined"],
  fulfilled: [],
  declined: ["reviewing"], // allow reopening
};

/** Public submit (rate-limited + honeypot). Re-validated server-side. */
export const productRequestCreateSchema = z.object({
  productName: z.string().min(1).max(200),
  category: z.string().max(120).optional(),
  brand: z.string().max(120).optional(),
  quantity: z.coerce.number().int().positive().max(1_000_000).optional(),
  budget: z.string().max(80).optional(),
  referenceUrl: z.string().max(512).optional(),
  details: z.string().max(5000).optional(),
  name: z.string().min(1).max(120),
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.email(),
  ),
  phone: z.string().max(40).optional(),
  /** Locale tag (en/bn/ja) so the auto-ack is sent in context. */
  locale: z.string().max(8).optional(),
  /** Honeypot — a filled value flags spam (silent fake-success in the route). */
  website: z.string().max(200).optional(),
});
export type ProductRequestCreateInput = z.infer<
  typeof productRequestCreateSchema
>;

// ---- Admin actions ----
export const productRequestNoteSchema = z.object({
  body: z.string().min(1).max(5000),
});
export type ProductRequestNoteInput = z.infer<typeof productRequestNoteSchema>;

export const productRequestAssignSchema = z.object({
  assignedTo: z.string().nullable(),
});
export type ProductRequestAssignInput = z.infer<
  typeof productRequestAssignSchema
>;

export const productRequestTransitionSchema = z.object({
  to: productRequestStatusEnum,
  note: z.string().max(1000).optional(),
});
export type ProductRequestTransitionInput = z.infer<
  typeof productRequestTransitionSchema
>;
