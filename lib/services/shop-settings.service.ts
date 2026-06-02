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
