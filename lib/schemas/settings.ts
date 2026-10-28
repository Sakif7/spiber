import { z } from "zod";
import { isAdSlotId, normalizePublisherId } from "@/lib/ads/adsense";

/** Shipping configuration (poisha). `freeThresholdMinor` null = never free. */
export const shippingSettingsSchema = z.object({
  flatFeeMinor: z.number().int().nonnegative(),
  freeThresholdMinor: z.number().int().nonnegative().nullable(),
});
export type ShippingSettingsInput = z.infer<typeof shippingSettingsSchema>;

/**
 * Medtrade commerce configuration. Rates are basis points (1500 = 15.00%).
 *
 * `vatRateBp` is CHARGED — it adds a VAT line to Medtrade order totals.
 * `aitRateBp` is INFORMATIONAL — Advance Income Tax is withheld at source by
 * the institutional buyer, so it never changes what we charge; it is shown on
 * the invoice as deductible. Both default to 0 (off) until an admin sets them.
 */
export const medtradeCommerceSettingsSchema = z.object({
  vatRateBp: z.number().int().min(0).max(10000),
  aitRateBp: z.number().int().min(0).max(10000),
});
export type MedtradeCommerceSettingsInput = z.infer<
  typeof medtradeCommerceSettingsSchema
>;

/**
 * Google AdSense on article pages. The publisher ID alone already serves
 * /ads.txt (one of Google's site checks), so it can be saved with ads off;
 * switching ads on needs both IDs. Stored as `pub-…` whichever form is pasted.
 */
export const adsenseSettingsSchema = z
  .object({
    enabled: z.boolean(),
    publisherId: z
      .string()
      .trim()
      .max(40)
      .refine(
        (v) => v === "" || normalizePublisherId(v) !== null,
        "should look like pub-1234567890123456",
      )
      .transform((v) => normalizePublisherId(v) ?? ""),
    inArticleSlot: z
      .string()
      .trim()
      .max(30)
      .refine((v) => v === "" || isAdSlotId(v), "should be the digits only"),
  })
  .superRefine((s, ctx) => {
    if (!s.enabled) return;
    for (const key of ["publisherId", "inArticleSlot"] as const) {
      if (s[key] === "")
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "needed before ads can be switched on",
        });
    }
  });
export type AdsenseSettingsInput = z.infer<typeof adsenseSettingsSchema>;
