import { getSetting, setSetting } from "@/lib/repositories/settings.repo";
import type { ShippingSettings } from "./pricing.service";

const SHIPPING_KEY = "shipping";

/** Defaults: ৳80 flat fee, free shipping over ৳5,000. */
const DEFAULTS: ShippingSettings = {
  flatFeeMinor: 8000,
  freeThresholdMinor: 500000,
};

export async function getShippingSettings(): Promise<ShippingSettings> {
  const stored = await getSetting<Partial<ShippingSettings>>(SHIPPING_KEY);
  return { ...DEFAULTS, ...(stored ?? {}) };
}

export async function setShippingSettings(settings: ShippingSettings) {
  await setSetting(SHIPPING_KEY, settings);
}

const MEDTRADE_COMMERCE_KEY = "medtradeCommerce";

/** Tax rates in basis points. Both OFF by default — an admin must opt in, so
 *  no money behaviour is ever seeded. */
export type MedtradeCommerceSettings = {
  /** VAT charged on Medtrade orders (added to the total). */
  vatRateBp: number;
  /** AIT shown on invoices as deductible at source (never charged). */
  aitRateBp: number;
};

const MEDTRADE_COMMERCE_DEFAULTS: MedtradeCommerceSettings = {
  vatRateBp: 0,
  aitRateBp: 0,
};

export async function getMedtradeCommerceSettings(): Promise<MedtradeCommerceSettings> {
  const stored = await getSetting<Partial<MedtradeCommerceSettings>>(
    MEDTRADE_COMMERCE_KEY,
  );
  return { ...MEDTRADE_COMMERCE_DEFAULTS, ...(stored ?? {}) };
}

export async function setMedtradeCommerceSettings(
  settings: MedtradeCommerceSettings,
) {
  await setSetting(MEDTRADE_COMMERCE_KEY, settings);
}

/** VAT argument for `priceCart`, or null when VAT is off. */
export function taxSettingsFor(
  commerce: MedtradeCommerceSettings | null,
): { rateBp: number } | null {
  return commerce && commerce.vatRateBp > 0
    ? { rateBp: commerce.vatRateBp }
    : null;
}
