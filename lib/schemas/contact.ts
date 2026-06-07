import { z } from "zod";

/**
 * Public Contact-form submission. Distinct from the generalized `Inquiry`
 * pipeline (sales/tourism/consulting leads) and the legacy `Quote` capture —
 * this is the website "Get in Touch" form: name + email + phone + a routed
 * inquiry type + a message. Persisted as a `ContactMessage` and emailed to the
 * team (routed by `inquiryType`) with an auto-acknowledgement to the sender.
 */

export const contactInquiryTypeEnum = z.enum([
  "sales",
  "support",
  "quotation",
  "partnership",
  "training",
]);
export type ContactInquiryType = z.infer<typeof contactInquiryTypeEnum>;

export const contactStatusEnum = z.enum([
  "new",
  "read",
  "responded",
  "archived",
]);
export type ContactStatus = z.infer<typeof contactStatusEnum>;

/** Public submit (rate-limited + honeypot). Re-validated server-side. */
export const contactMessageCreateSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.email(),
  ),
  phone: z.string().min(3).max(40),
  country: z.string().min(1).max(60),
  inquiryType: contactInquiryTypeEnum,
  message: z.string().min(1).max(5000),
  /** Optional locale tag (en/bn) so the auto-ack can be sent in context. */
  locale: z.string().max(8).optional(),
  /**
   * Honeypot — a hidden field real users never see. Bots tend to fill every
   * input, so a non-empty value flags spam. Kept lenient here (bounded string)
   * and handled in the route: a filled honeypot gets a silent fake-success so
   * the bot learns nothing, while nothing is persisted or emailed.
   */
  website: z.string().max(200).optional(),
});
export type ContactMessageCreateInput = z.infer<
  typeof contactMessageCreateSchema
>;
