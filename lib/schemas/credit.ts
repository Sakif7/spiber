import { z } from "zod";

/**
 * Medtrade credit-facility ("enlistment") application. Submitted by a logged-in
 * institutional buyer; on approval an admin provisions a `CreditAccount` and
 * the buyer can pay on terms at checkout.
 *
 * Deliberately grants NO role — eligibility is read from the account at
 * checkout, so approving or suspending takes effect immediately. Mirrors the
 * SellerApplication pipeline (status machine + activity + KYC documents).
 */

export const creditApplicationStatusEnum = z.enum([
  "new",
  "reviewing",
  "approved",
  "rejected",
]);
export type CreditApplicationStatus = z.infer<
  typeof creditApplicationStatusEnum
>;

export const CREDIT_APP_TRANSITIONS: Record<
  CreditApplicationStatus,
  CreditApplicationStatus[]
> = {
  new: ["reviewing", "rejected"],
  reviewing: ["approved", "rejected"],
  approved: [],
  rejected: ["reviewing"], // allow reopening
};

/** Documents collected to verify an institution's standing. */
export const CREDIT_DOC_TYPES = [
  "trade_license",
  "tin_certificate",
  "bin_certificate",
  "bank_statement",
  "national_id",
] as const;
export type CreditDocType = (typeof CREDIT_DOC_TYPES)[number];

/**
 * Only the trade licence is mandatory: it is the one document every registered
 * hospital, clinic and distributor in Bangladesh reliably holds. The rest help
 * the credit decision but must not block an application.
 */
export const REQUIRED_CREDIT_DOCS: readonly string[] = ["trade_license"];

export const creditAppDocumentSchema = z.object({
  label: z.enum(CREDIT_DOC_TYPES),
  /** PRIVATE storage key returned by /api/credit/apply/uploads. */
  key: z.string().min(1).max(512),
  filename: z.string().min(1).max(200),
  size: z.number().int().min(0).optional(),
  mime: z.string().max(120).optional(),
});
export type CreditAppDocumentInput = z.infer<typeof creditAppDocumentSchema>;

/** Public submit — AUTH REQUIRED (userId comes from the session, not input). */
export const creditApplicationCreateSchema = z
  .object({
    organization: z.string().min(1).max(160),
    contactName: z.string().min(1).max(120),
    email: z.preprocess(
      (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
      z.email(),
    ),
    phone: z.string().min(6).max(40),
    address: z.string().max(300).optional(),
    /** Institution type, free text: hospital, clinic, diagnostic centre, … */
    organizationType: z.string().max(120).optional(),
    tradeLicenseNo: z.string().max(80).optional(),
    tinNumber: z.string().max(80).optional(),
    binNumber: z.string().max(80).optional(),
    /** Rough monthly spend, in poisha — helps size the facility. */
    expectedMonthlyVolumeMinor: z.number().int().nonnegative().optional(),
    description: z.string().min(1).max(5000),
    documents: z.array(creditAppDocumentSchema).max(8).default([]),
    /** Must be true — the applicant accepts the credit terms. */
    termsAccepted: z.literal(true),
    locale: z.string().max(8).optional(),
  })
  .superRefine((val, ctx) => {
    const labels = new Set<string>(val.documents.map((d) => d.label));
    for (const required of REQUIRED_CREDIT_DOCS) {
      if (!labels.has(required)) {
        ctx.addIssue({
          code: "custom",
          path: ["documents"],
          message: `missing_required_document:${required}`,
        });
      }
    }
  });
export type CreditApplicationCreateInput = z.infer<
  typeof creditApplicationCreateSchema
>;

// ---- Admin actions ----
export const creditApplicationNoteSchema = z.object({
  body: z.string().min(1).max(5000),
});
export type CreditApplicationNoteInput = z.infer<
  typeof creditApplicationNoteSchema
>;

export const creditApplicationAssignSchema = z.object({
  assignedTo: z.string().nullable(),
});
export type CreditApplicationAssignInput = z.infer<
  typeof creditApplicationAssignSchema
>;

export const creditApplicationTransitionSchema = z.object({
  to: creditApplicationStatusEnum,
  note: z.string().max(1000).optional(),
  /** Net terms to grant on approval; defaults to 30 when omitted. */
  termsDays: z.number().int().min(1).max(365).optional(),
});
export type CreditApplicationTransitionInput = z.infer<
  typeof creditApplicationTransitionSchema
>;

/** Admin edit of a live credit account. */
export const creditAccountUpdateSchema = z.object({
  termsDays: z.number().int().min(1).max(365).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  notes: z.string().max(2000).optional(),
});
export type CreditAccountUpdateInput = z.infer<
  typeof creditAccountUpdateSchema
>;
