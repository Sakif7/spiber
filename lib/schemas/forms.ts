import { z } from "zod";

/** Normalize an email: trim + lowercase, then validate. */
const email = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.email(),
);

const trimmed = (max: number) => z.string().trim().max(max);

/** Newsletter subscription input (footer form → POST /api/newsletter). */
export const newsletterInputSchema = z.object({
  email,
});
export type NewsletterInput = z.infer<typeof newsletterInputSchema>;

/** Contact / quote request input (server source of truth → POST /api/quote). */
export const contactInputSchema = z.object({
  name: trimmed(200).min(1),
  email,
  org: trimmed(200).optional().default(""),
  phone: trimmed(50).optional().default(""),
  category: trimmed(100).optional().default("general"),
  message: trimmed(5000).min(1),
});
export type ContactInput = z.infer<typeof contactInputSchema>;

/**
 * Client form schema (no transforms/defaults) so input and output types match
 * for react-hook-form. The server re-validates with `contactInputSchema`.
 */
export const contactFormSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  org: z.string().optional(),
  phone: z.string().optional(),
  category: z.string().optional(),
  message: z.string().min(1),
});
export type ContactFormValues = z.infer<typeof contactFormSchema>;
