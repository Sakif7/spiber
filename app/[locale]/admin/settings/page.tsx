import { setRequestLocale } from "next-intl/server";
import {
  getShippingSettings,
  getMedtradeCommerceSettings,
} from "@/lib/services/shop-settings.service";
import { ShippingForm } from "@/components/admin/shipping-form";
import { MedtradeTaxForm } from "@/components/admin/medtrade-tax-form";

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

  let vatRateBp = 0;
  let aitRateBp = 0;
  try {
    const commerce = await getMedtradeCommerceSettings();
    vatRateBp = commerce.vatRateBp;
    aitRateBp = commerce.aitRateBp;
  } catch {
    vatRateBp = 0;
    aitRateBp = 0;
  }

  const heading: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: "var(--fs-h2)",
    color: "var(--color-text-strong)",
    margin: 0,
  };

  return (
    <div style={{ display: "grid", gap: "var(--s-6)", maxWidth: 560 }}>
      <div style={{ display: "grid", gap: "var(--s-4)" }}>
        <h1 style={heading}>Shipping settings</h1>
        <ShippingForm
          initialFlatFeeMinor={flatFeeMinor}
          initialFreeThresholdMinor={freeThresholdMinor}
        />
      </div>

      <div style={{ display: "grid", gap: "var(--s-4)" }}>
        <h2 style={heading}>Medtrade tax</h2>
        <MedtradeTaxForm
          initialVatRateBp={vatRateBp}
          initialAitRateBp={aitRateBp}
        />
      </div>
    </div>
  );
}
