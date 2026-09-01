import { z } from "zod";

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
