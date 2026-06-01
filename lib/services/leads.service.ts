import { upsertSubscriber, createQuote } from "@/lib/repositories/leads.repo";
import { logger } from "@/lib/log";
import type { NewsletterInput, ContactInput } from "@/lib/schemas/forms";

/**
 * Lead capture. Persistence degrades gracefully: when the DB is unavailable we
 * still acknowledge the submission (`persisted: false`) rather than 500, so the
 * public form UX is unaffected. Email notification is wired in a later step.
 */

export async function subscribeToNewsletter(
  input: NewsletterInput,
): Promise<{ persisted: boolean }> {
  try {
    await upsertSubscriber(input);
    return { persisted: true };
  } catch (err) {
    logger.warn("leads.subscribeToNewsletter failed", err);
    return { persisted: false };
  }
}

export async function submitQuote(
  input: ContactInput,
): Promise<{ persisted: boolean }> {
  try {
    await createQuote(input);
    return { persisted: true };
  } catch (err) {
    logger.warn("leads.submitQuote failed", err);
    return { persisted: false };
  }
}
