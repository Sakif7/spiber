import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { CheckoutForm } from "@/components/shop/checkout-form";
import { onlinePaymentAvailable } from "@/lib/services/payment.service";
import { getSessionUser } from "@/lib/auth/current-user";
import { findUserById } from "@/lib/repositories/users.repo";
import { getActiveCreditAccount } from "@/lib/repositories/credit-accounts.repo";
import { DEFAULT_CREDIT_TERMS_DAYS } from "@/lib/models/credit-account";

export const dynamic = "force-dynamic";

/**
 * Medtrade checkout. Same engine as Spiber Kart, but VAT applies and the buyer
 * chooses COD or — if they hold an ACTIVE credit account — payment on terms.
 * Eligibility is resolved here for the UI and re-checked server-side in
 * `placeOrder`, so the radio can never grant anyone credit.
 */
export default async function MedtradeCheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "shop.checkout" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  // Prefill for logged-in customers from their profile + default address.
  let initial: Record<string, string> | undefined;
  let creditEligible = false;
  let creditTermsDays = DEFAULT_CREDIT_TERMS_DAYS;
  const session = await getSessionUser();
  if (session) {
    const doc = await findUserById(session.sub).catch(() => null);
    if (doc && !doc.disabled) {
      const a = doc.defaultAddress;
      initial = {
        fullName: doc.name,
        email: doc.email,
        phone: doc.phone ?? a?.phone ?? "",
        line1: a?.line1 ?? "",
        line2: a?.line2 ?? "",
        city: a?.city ?? "",
        district: a?.district ?? "",
        postalCode: a?.postalCode ?? "",
      };
    }
    const account = await getActiveCreditAccount(session.sub).catch(() => null);
    if (account) {
      creditEligible = true;
      creditTermsDays = account.termsDays;
    }
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("instruments"), href: "/medtrade" },
          { label: t("title") },
        ]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container>
          <CheckoutForm
            onlineAvailable={await onlinePaymentAvailable("instruments")}
            initial={initial}
            storefront="instruments"
            basePath="/medtrade"
            creditEligible={creditEligible}
            creditTermsDays={creditTermsDays}
            creditApplyHref="/medtrade/credit-facility"
          />
        </Container>
      </section>
    </>
  );
}
