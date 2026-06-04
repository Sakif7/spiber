import { z } from "zod";

/**
 * Generalized lead/inquiry pipeline — ONE model for Systems custom-solutions,
 * Tourism package leads, and Consulting advisory (`division` discriminates).
 * Built now for Systems; Tourism/Consulting wire into it in Phases 4–5. This is
 * distinct from the legacy `Quote`/leads capture, which is left untouched.
 */

export const inquiryDivisionEnum = z.enum(["systems", "tourism", "consulting"]);
export type InquiryDivision = z.infer<typeof inquiryDivisionEnum>;

export const inquiryStatusEnum = z.enum([
  "new",
  "qualifying",
  "proposal",
  "won",
  "lost",
]);
export type InquiryStatus = z.infer<typeof inquiryStatusEnum>;

/** Allowed status transitions enforced by the inquiry service. */
export const INQUIRY_TRANSITIONS: Record<InquiryStatus, InquiryStatus[]> = {
  new: ["qualifying", "lost"],
  qualifying: ["proposal", "lost"],
  proposal: ["won", "lost"],
  won: [],
  lost: ["qualifying"], // allow reopening a lost lead
};

export const inquiryLinkedEntitySchema = z.object({
  kind: z.enum(["software", "package", "service"]),
  id: z.string().min(1),
});
export type InquiryLinkedEntity = z.infer<typeof inquiryLinkedEntitySchema>;

/** Public submit (rate-limited). The division-specific route fixes `division`. */
export const inquiryCreateSchema = z.object({
  division: inquiryDivisionEnum,
  subject: z.string().max(200).optional(),
  name: z.string().min(1).max(120),
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.email(),
  ),
  phone: z.string().max(40).optional(),
  company: z.string().max(160).optional(),
  message: z.string().min(1).max(5000),
  budgetRange: z.string().max(60).optional(),
  linkedEntity: inquiryLinkedEntitySchema.optional(),
  // Bounded so this public (only-rate-limited) endpoint can't be used to store
  // an arbitrarily large/deep blob: ≤30 keys of primitive values.
  payload: z
    .record(
      z.string().max(64),
      z.union([z.string().max(2000), z.number(), z.boolean()]),
    )
    .refine((p) => Object.keys(p).length <= 30, {
      message: "too many fields",
    })
    .optional(),
});
export type InquiryCreateInput = z.infer<typeof inquiryCreateSchema>;

// ---- Admin actions ----
export const inquiryNoteSchema = z.object({
  body: z.string().min(1).max(5000),
});
export type InquiryNoteInput = z.infer<typeof inquiryNoteSchema>;

export const inquiryAssignSchema = z.object({
  assignedTo: z.string().nullable(),
});
export type InquiryAssignInput = z.infer<typeof inquiryAssignSchema>;

export const inquiryTransitionSchema = z.object({
  to: inquiryStatusEnum,
  note: z.string().max(1000).optional(),
});
export type InquiryTransitionInput = z.infer<typeof inquiryTransitionSchema>;
