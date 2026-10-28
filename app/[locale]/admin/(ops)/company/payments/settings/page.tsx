import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { getPaymentSettings } from "@/lib/services/payment-settings.service";
import { PAYMENT_SETTINGS_DEFAULTS } from "@/lib/schemas/payment";
import { todayKey } from "@/lib/hr/cycles";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { PaymentSettingsForm } from "@/components/admin/payments/payment-settings-form";
import { FeeRatesCard } from "@/components/admin/payments/fee-rates-card";

export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Again here, not only in the layout: Next renders a page alongside its
  // layout and ships the page's payload even when the layout refuses.
  if (!(await requireSuperAdmin())) return null;

  const settings = await getPaymentSettings().catch(
    () => PAYMENT_SETTINGS_DEFAULTS,
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Payment settings"
        description="Where customers can pay online, and what PayStation charges for it."
        action={
          <Link
            href="/admin/company/payments"
            className="text-primary font-medium hover:underline"
          >
            Back to online payments
          </Link>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <section className="space-y-3" aria-labelledby="payments-points">
          <div className="space-y-0.5">
            <h2
              id="payments-points"
              className="text-foreground text-base font-semibold"
            >
              Where customers can pay online
            </h2>
            <p className="text-muted-foreground text-sm">
              Each door is switched on separately, so PayStation can go live one
              at a time. Cash on delivery and credit stay as they are.
            </p>
          </div>
          <PaymentSettingsForm
            initial={{ points: settings.points, emi: settings.emi }}
            hasFeeRates={settings.feeRates.length > 0}
          />
        </section>

        <section className="space-y-3" aria-labelledby="payments-fees">
          <div className="space-y-0.5">
            <h2
              id="payments-fees"
              className="text-foreground text-base font-semibold"
            >
              PayStation&apos;s fee rates
            </h2>
            <p className="text-muted-foreground text-sm">
              The company bears the fee, so it is booked as a cost. Example: a
              ৳10,000 order paid by bKash at 1.85% costs ৳185.
            </p>
          </div>
          <FeeRatesCard versions={settings.feeRates} today={todayKey()} />
        </section>
      </div>
    </div>
  );
}
