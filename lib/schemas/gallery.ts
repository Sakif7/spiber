import { z } from "zod";
import { localizedSchema } from "./localized";

/**
 * Gallery model. An album groups many photos under a localized title; each
 * photo is a public image URL with an optional localized caption. Zod is the
 * single source of truth. Albums are visible publicly when status = published.
 */

export const galleryStatusEnum = z.enum(["draft", "published"]);
export type GalleryStatus = z.infer<typeof galleryStatusEnum>;

export const galleryImageSchema = z.object({
  url: z.string().min(1),
  caption: localizedSchema.optional(),
});
export type GalleryImageInput = z.infer<typeof galleryImageSchema>;

// `slug` optional on input; the route derives it from `title.en` when blank.
export const galleryAlbumSchema = z.object({
  title: localizedSchema,
  slug: z.string().max(160).optional(),
  description: localizedSchema.optional(),
  coverImage: z.string().optional(),
  date: z.coerce.date().optional(),
  images: z.array(galleryImageSchema).default([]),
  status: galleryStatusEnum.default("draft"),
});
export type GalleryAlbumInput = z.infer<typeof galleryAlbumSchema>;
