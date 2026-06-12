import { z } from "zod";
import { tourismDocumentSchema } from "./medical-case";

/**
 * PartnerApplication — "Partner With Us" submissions from hospitals, doctors,
 * agencies, diagnostic centres, insurers. A lead pipeline with optional secure
 * documents (credentials/accreditations), reviewed by an admin. Mirrors the
 * pipeline conventions (state machine + activity + soft-delete).
 */

export const partnerTypeEnum = z.enum([
  "hospital",
  "doctor",
  "agency",
  "diagnostic",
  "insurance",
]);
export type PartnerType = z.infer<typeof partnerTypeEnum>;

export const partnerApplicationStatusEnum = z.enum([
  "new",
  "reviewing",
  "approved",
  "rejected",
]);
export type PartnerApplicationStatus = z.infer<
  typeof partnerApplicationStatusEnum
>;

export const PARTNER_APP_TRANSITIONS: Record<
  PartnerApplicationStatus,
  PartnerApplicationStatus[]
> = {
  new: ["reviewing", "rejected"],
  reviewing: ["approved", "rejected"],
  approved: [],
  rejected: ["reviewing"], // allow reopening
};

const email = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.email(),
);

/** Public submit (rate-limited + honeypot). */
export const partnerApplicationCreateSchema = z.object({
  type: partnerTypeEnum,
  orgInfo: z.object({
    name: z.string().min(1).max(200),
    website: z.string().max(200).optional(),
    country: z.string().max(80).optional(),
    description: z.string().max(5000).optional(),
  }),
  contact: z.object({
    name: z.string().min(1).max(120),
    email,
    phone: z.string().min(3).max(40),
  }),
  documents: z.array(tourismDocumentSchema).max(20).optional(),
  locale: z.string().max(8).optional(),
  website: z.string().max(200).optional(),
});
export type PartnerApplicationCreateInput = z.infer<
  typeof partnerApplicationCreateSchema
>;

// ---- Admin actions ----
export const partnerApplicationNoteSchema = z.object({
  body: z.string().min(1).max(5000),
});
export type PartnerApplicationNoteInput = z.infer<
  typeof partnerApplicationNoteSchema
>;

export const partnerApplicationAssignSchema = z.object({
  assignedTo: z.string().nullable(),
});
export type PartnerApplicationAssignInput = z.infer<
  typeof partnerApplicationAssignSchema
>;

export const partnerApplicationTransitionSchema = z.object({
  to: partnerApplicationStatusEnum,
  note: z.string().max(1000).optional(),
});
export type PartnerApplicationTransitionInput = z.infer<
  typeof partnerApplicationTransitionSchema
>;
