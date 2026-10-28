import { getSetting, setSetting } from "@/lib/repositories/settings.repo";
import { ADSENSE_DEFAULTS, type AdsenseSettings } from "@/lib/ads/adsense";

const ADSENSE_KEY = "adsense";

/** Off by default: no ad ever shows until a super admin switches it on. */
export async function getAdsenseSettings(): Promise<AdsenseSettings> {
  const stored = await getSetting<Partial<AdsenseSettings>>(ADSENSE_KEY);
  return { ...ADSENSE_DEFAULTS, ...(stored ?? {}) };
}

export async function setAdsenseSettings(settings: AdsenseSettings) {
  await setSetting(ADSENSE_KEY, settings);
}
