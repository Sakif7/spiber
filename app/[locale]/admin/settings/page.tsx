import { setRequestLocale } from "next-intl/server";
import { getShippingSettings } from "@/lib/services/shop-settings.service";
import { ShippingForm } from "@/components/admin/shipping-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let flatFeeMinor = 0;
  let freeThresholdMinor: number | null = null;
  try {
    const settings = await getShippingSettings();
    flatFeeMinor = settings.flatFeeMinor;
    freeThresholdMinor = settings.freeThresholdMinor;
  } catch {
    flatFeeMinor = 0;
    freeThresholdMinor = null;
  }

  return (
    <div style={{ display: "grid", gap: "var(--s-6)", maxWidth: 560 }}>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-h2)",
          color: "var(--color-text-strong)",
          margin: 0,
        }}
      >
        Shipping settings
      </h1>
      <ShippingForm
        initialFlatFeeMinor={flatFeeMinor}
        initialFreeThresholdMinor={freeThresholdMinor}
      />
    </div>
  );
}
