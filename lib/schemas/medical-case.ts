import { z } from "zod";

/**
 * MedicalCase — the Spiber Tourism funnel (the backbone of the division). A
 * patient submits a case with their reports (secure document upload); a case
 * manager reviews, attaches a hospital quotation, the patient confirms, and the
 * arrangement checklist (appointment/visa/air ticket/accommodation/transfer) is
 * worked through treatment + follow-up. Modeled on the Quotation pipeline
 * (state machine + quote subdoc + activity log + soft-delete).
 */

export const medicalCaseStatusEnum = z.enum([
  "new",
  "reviewing",
  "quoted",
  "confirmed",
  "arranging",
  "in_treatment",
  "follow_up",
  "closed",
  "lost",
]);
export type MedicalCaseStatus = z.infer<typeof medicalCaseStatusEnum>;

/** The 9-step funnel, enforced by the medical-case service. */
export const MEDICAL_CASE_TRANSITIONS: Record<
  MedicalCaseStatus,
  MedicalCaseStatus[]
> = {
  new: ["reviewing", "lost"],
  reviewing: ["quoted", "lost"],
  quoted: ["confirmed", "lost"],
  confirmed: ["arranging", "lost"],
  arranging: ["in_treatment", "lost"],
  in_treatment: ["follow_up"],
  follow_up: ["closed"],
  closed: [],
  lost: ["reviewing"], // allow reopening a lost case
};

export const checklistKeyEnum = z.enum([
  "appointment",
  "visa",
  "airTicket",
  "accommodation",
  "airportTransfer",
]);
export type ChecklistKey = z.infer<typeof checklistKeyEnum>;

const email = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.email(),
);

/**
 * A secure document descriptor. The file itself lives in PRIVATE storage and is
 * only reachable through the auth-gated `/api/media/case` route — `fileKey` is
 * the raw storage key, never a public URL, and is NEVER returned to patients.
 * Shared with PartnerApplication.
 */
export const tourismDocumentSchema = z.object({
  name: z.string().min(1).max(255),
  fileKey: z.string().min(1).max(512),
  contentType: z.string().max(120).optional(),
});
export type TourismDocumentInput = z.infer<typeof tourismDocumentSchema>;

/** Public submit (rate-limited + honeypot). Consent is mandatory. */
export const medicalCaseCreateSchema = z.object({
  patient: z.object({
    name: z.string().min(1).max(120),
    country: z.string().min(1).max(80),
    email,
    phone: z.string().min(3).max(40),
  }),
  diagnosis: z.string().max(5000).optional(),
  requestedService: z.string().max(300).optional(),
  hospitalId: z.string().min(1).optional(),
  doctorId: z.string().min(1).optional(),
  packageId: z.string().min(1).optional(),
  documents: z.array(tourismDocumentSchema).max(20).optional(),
  /** Privacy consent — must be explicitly accepted to submit health data. */
  consent: z.literal(true),
  /** Locale tag (en/bn) so the auto-ack is sent in context. Not persisted. */
  locale: z.string().max(8).optional(),
  /** Honeypot — see contact schema; a filled value gets a silent fake-success. */
  website: z.string().max(200).optional(),
});
export type MedicalCaseCreateInput = z.infer<typeof medicalCaseCreateSchema>;

// ---- Admin actions ----
export const medicalCaseNoteSchema = z.object({
  body: z.string().min(1).max(5000),
});
export type MedicalCaseNoteInput = z.infer<typeof medicalCaseNoteSchema>;

export const medicalCaseAssignSchema = z.object({
  assignedTo: z.string().nullable(),
});
export type MedicalCaseAssignInput = z.infer<typeof medicalCaseAssignSchema>;

export const medicalCaseTransitionSchema = z.object({
  to: medicalCaseStatusEnum,
  note: z.string().max(1000).optional(),
});
export type MedicalCaseTransitionInput = z.infer<
  typeof medicalCaseTransitionSchema
>;

/** Case manager attaches the hospital quotation (rendered on demand, no PDF). */
export const medicalCaseQuoteSchema = z.object({
  amountMinor: z.number().int().nonnegative().optional(),
  validUntil: z.coerce.date().optional(),
  notes: z.string().max(3000).optional(),
});
export type MedicalCaseQuoteInput = z.infer<typeof medicalCaseQuoteSchema>;

export const medicalCaseChecklistSchema = z.object({
  key: checklistKeyEnum,
  done: z.boolean(),
  note: z.string().max(1000).optional(),
});
export type MedicalCaseChecklistInput = z.infer<
  typeof medicalCaseChecklistSchema
>;
