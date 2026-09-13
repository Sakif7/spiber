import { setRequestLocale } from "next-intl/server";
import {
  getShippingSettings,
  getMedtradeCommerceSettings,
} from "@/lib/services/shop-settings.service";
import { ShippingForm } from "@/components/admin/shipping-form";
import { MedtradeTaxForm } from "@/components/admin/medtrade-tax-form";
import { AdminPageHeader } from "@/components/admin/ui/page-header";

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

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Commerce settings"
        description="Shipping applies to Spiber Kart and Medtrade orders. VAT and AIT apply to Medtrade only."
      />

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="space-y-3" aria-labelledby="settings-shipping">
          <div className="space-y-0.5">
            <h2
              id="settings-shipping"
              className="text-foreground text-base font-semibold"
            >
              Shipping
            </h2>
            <p className="text-muted-foreground text-sm">
              Flat fee and the free-shipping threshold for every order.
            </p>
          </div>
          <ShippingForm
            initialFlatFeeMinor={flatFeeMinor}
            initialFreeThresholdMinor={freeThresholdMinor}
          />
        </section>

        <section className="space-y-3" aria-labelledby="settings-tax">
          <div className="space-y-0.5">
            <h2
              id="settings-tax"
              className="text-foreground text-base font-semibold"
            >
              Medtrade tax
            </h2>
            <p className="text-muted-foreground text-sm">
              VAT is charged on Medtrade orders. AIT is shown on invoices as
              deductible at source and never changes the total.
            </p>
          </div>
          <MedtradeTaxForm
            initialVatRateBp={vatRateBp}
            initialAitRateBp={aitRateBp}
          />
        </section>
      </div>
    </div>
  );
}
