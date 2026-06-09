import { z } from "zod";
import { localizedSchema } from "./localized";

/**
 * Events model. Informational event listings (conferences, workshops,
 * announcements) with a start/optional-end date, localized description, and an
 * optional external registration link. Zod is the single source of truth.
 * Visible publicly when status = published.
 */

export const eventStatusEnum = z.enum(["draft", "published"]);
export type EventStatus = z.infer<typeof eventStatusEnum>;

// `slug` optional on input; the route derives it from `title.en` when blank.
export const eventSchema = z
  .object({
    title: localizedSchema,
    slug: z.string().max(160).optional(),
    summary: localizedSchema.optional(),
    description: localizedSchema,
    coverImage: z.string().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    location: localizedSchema.optional(),
    registrationUrl: z.string().url().max(500).optional().or(z.literal("")),
    status: eventStatusEnum.default("draft"),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });
export type EventInput = z.infer<typeof eventSchema>;
