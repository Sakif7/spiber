import { connectToDatabase } from "@/lib/db/connect";
import { Subscriber } from "@/lib/models/subscriber";
import { Quote } from "@/lib/models/quote";
import type { NewsletterInput, ContactInput } from "@/lib/schemas/forms";

/** Lead-capture writes (newsletter signup + quote/contact request). */

export async function upsertSubscriber(input: NewsletterInput): Promise<void> {
  await connectToDatabase();
  // Idempotent: insert on first sight, no-op on repeat.
  await Subscriber.updateOne(
    { email: input.email },
    { $setOnInsert: { email: input.email } },
    { upsert: true },
  ).exec();
}

export async function createQuote(input: ContactInput): Promise<void> {
  await connectToDatabase();
  await Quote.create(input);
}
