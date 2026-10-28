import { setRequestLocale } from "next-intl/server";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { getAdsenseSettings } from "@/lib/services/ads-settings.service";
import { ADSENSE_DEFAULTS, type AdsenseSettings } from "@/lib/ads/adsense";
import { AdsSettingsForm } from "@/components/admin/blog/ads-settings-form";
import { AdminPageHeader } from "@/components/admin/ui/page-header";

export const dynamic = "force-dynamic";

export default async function AdminBlogAdsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Again here, not only in the layout: Next renders a page alongside its
  // layout and ships the page's payload even when the layout shows the
  // refusal instead of `children`.
  if (!(await requireSuperAdmin())) return null;

  let settings: AdsenseSettings = ADSENSE_DEFAULTS;
  try {
    settings = await getAdsenseSettings();
  } catch {
    settings = ADSENSE_DEFAULTS;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Ads"
        description="Google ads inside blog posts. Shops, checkout and accounts never show ads."
      />

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="space-y-3" aria-labelledby="ads-adsense">
          <div className="space-y-0.5">
            <h2
              id="ads-adsense"
              className="text-foreground text-base font-semibold"
            >
              Google AdSense
            </h2>
            <p className="text-muted-foreground text-sm">
              Two ads per post, after the 3rd and the 6th paragraph. A post too
              short for a slot simply goes without.
            </p>
          </div>
          <AdsSettingsForm initial={settings} />
        </section>
      </div>
    </div>
  );
}
