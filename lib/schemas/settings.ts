import { z } from "zod";

/** Shipping configuration (poisha). `freeThresholdMinor` null = never free. */
export const shippingSettingsSchema = z.object({
  flatFeeMinor: z.number().int().nonnegative(),
  freeThresholdMinor: z.number().int().nonnegative().nullable(),
});
export type ShippingSettingsInput = z.infer<typeof shippingSettingsSchema>;
