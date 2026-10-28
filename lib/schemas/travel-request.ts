import { z } from "zod";
import { collectOnlineMinorField } from "./payment";

/**
 * TravelRequest — a MANUAL request form for air ticket / hotel / visa / airport
 * transfer. These are NOT live searches: the patient submits a structured
 * request and an admin records a quote/confirmation manually, behind the
 * pluggable `lib/travel` provider seam (manual default). Optionally linked to a
 * MedicalCase. Mirrors the pipeline conventions (state machine + activity).
 */

export const travelRequestTypeEnum = z.enum([
  "air",
  "hotel",
  "visa",
  "transfer",
]);
export type TravelRequestType = z.infer<typeof travelRequestTypeEnum>;

export const travelRequestStatusEnum = z.enum([
  "new",
  "quoted",
  "confirmed",
  "closed",
  "cancelled",
]);
export type TravelRequestStatus = z.infer<typeof travelRequestStatusEnum>;

export const TRAVEL_REQUEST_TRANSITIONS: Record<
  TravelRequestStatus,
  TravelRequestStatus[]
> = {
  new: ["quoted", "cancelled"],
  quoted: ["confirmed", "cancelled"],
  confirmed: ["closed"],
  closed: [],
  cancelled: [],
};

const email = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.email(),
);

/**
 * Per-type fields (origin/destination/dates for air; city/check-in/out for
 * hotel; etc.) are carried in a BOUNDED record of primitives — the same pattern
 * as the Inquiry `payload` (≤30 keys). The type-specific form supplies the
 * right keys; the admin reads them. Stored as Mixed on the model.
 */
const detailsRecord = z
  .record(
    z.string().max(64),
    z.union([z.string().max(2000), z.number(), z.boolean()]),
  )
  .refine((p) => Object.keys(p).length <= 30, { message: "too many fields" });

/** Public submit (rate-limited + honeypot). */
export const travelRequestCreateSchema = z.object({
  type: travelRequestTypeEnum,
  details: detailsRecord,
  linkedCaseId: z.string().min(1).optional(),
  contact: z.object({
    name: z.string().min(1).max(120),
    email,
    phone: z.string().min(3).max(40),
  }),
  locale: z.string().max(8).optional(),
  website: z.string().max(200).optional(),
});
export type TravelRequestCreateInput = z.infer<
  typeof travelRequestCreateSchema
>;

// ---- Admin actions ----
export const travelRequestNoteSchema = z.object({
  body: z.string().min(1).max(5000),
});
export type TravelRequestNoteInput = z.infer<typeof travelRequestNoteSchema>;

export const travelRequestAssignSchema = z.object({
  assignedTo: z.string().nullable(),
});
export type TravelRequestAssignInput = z.infer<
  typeof travelRequestAssignSchema
>;

export const travelRequestTransitionSchema = z.object({
  to: travelRequestStatusEnum,
  note: z.string().max(1000).optional(),
});
export type TravelRequestTransitionInput = z.infer<
  typeof travelRequestTransitionSchema
>;

export const travelRequestQuoteSchema = z
  .object({
    amountMinor: z.number().int().nonnegative().optional(),
    /** Offered as a pay link: the whole quote, an advance or our fee. */
    collectOnlineMinor: collectOnlineMinorField,
    note: z.string().max(2000).optional(),
  })
  .refine(
    (q) =>
      q.collectOnlineMinor == null ||
      q.amountMinor == null ||
      q.collectOnlineMinor <= q.amountMinor,
    {
      message: "Can't collect more than the quote",
      path: ["collectOnlineMinor"],
    },
  );
export type TravelRequestQuoteInput = z.infer<typeof travelRequestQuoteSchema>;
