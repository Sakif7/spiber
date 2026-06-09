import { slugify } from "@/lib/slug";
import { createEvent, updateEvent } from "@/lib/repositories/events.repo";
import type { EventInput } from "@/lib/schemas/events";
import type { IEvent } from "@/lib/models/event";

export type SaveEventResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; code: "duplicate" | "not_found" };

function isDuplicateKeyError(e: unknown): boolean {
  return (e as { code?: number } | null)?.code === 11000;
}

/**
 * Create or update an event. Derives the slug from `slug || title.en`. Duplicate
 * slugs (unique index) are returned as a typed result, not thrown.
 */
export async function saveEvent(
  input: EventInput,
  id?: string,
): Promise<SaveEventResult> {
  const slug = slugify(input.slug || input.title.en);
  const data: Partial<IEvent> = {
    title: input.title,
    slug,
    summary: input.summary,
    description: input.description,
    coverImage: input.coverImage || undefined,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    location: input.location,
    registrationUrl: input.registrationUrl || undefined,
    status: input.status,
  };
  try {
    if (id) {
      const updated = await updateEvent(id, data);
      if (!updated) return { ok: false, code: "not_found" };
      return { ok: true, id: String(updated._id), slug: updated.slug };
    }
    const created = await createEvent(data);
    return { ok: true, id: String(created._id), slug: created.slug };
  } catch (e) {
    if (isDuplicateKeyError(e)) return { ok: false, code: "duplicate" };
    throw e;
  }
}
