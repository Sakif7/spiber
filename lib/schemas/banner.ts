import { z } from "zod";
import { localizedSchema } from "./localized";

/** Marketplace promotional slots: hero carousel, deal cards, trust strip. */
export const bannerSlotEnum = z.enum(["hero", "deal", "strip"]);
export type BannerSlot = z.infer<typeof bannerSlotEnum>;

export const bannerSchema = z.object({
  slot: bannerSlotEnum,
  title: localizedSchema,
  subtitle: localizedSchema.optional(),
  image: z.string().optional(),
  images: z.array(z.string()).max(6).optional(),
  href: z.string().max(512).optional(),
  cta: localizedSchema.optional(),
  position: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
});
export type BannerInput = z.infer<typeof bannerSchema>;

export const bannerUpdateSchema = bannerSchema.partial();
export type BannerUpdateInput = z.infer<typeof bannerUpdateSchema>;
