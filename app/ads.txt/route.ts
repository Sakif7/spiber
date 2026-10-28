import { adsTxt, normalizePublisherId } from "@/lib/ads/adsense";
import { getAdsenseSettings } from "@/lib/services/ads-settings.service";

export const dynamic = "force-dynamic";

const TEXT = { "Content-Type": "text/plain; charset=utf-8" };

/**
 * /ads.txt — names the publisher ID Google may sell this site's ad space
 * for. Served as soon as a super admin saves the ID, even with ads off,
 * because Google reads it while it reviews the site; 404 until then.
 */
export async function GET() {
  let publisherId: string | null;
  try {
    publisherId = normalizePublisherId(
      (await getAdsenseSettings()).publisherId,
    );
  } catch {
    // A crawler that gets a 404 assumes there is no file; tell it to retry.
    return new Response("Unavailable\n", { status: 503, headers: TEXT });
  }
  if (!publisherId) {
    return new Response("Not found\n", { status: 404, headers: TEXT });
  }
  return new Response(adsTxt(publisherId), {
    headers: { ...TEXT, "Cache-Control": "public, max-age=300" },
  });
}
