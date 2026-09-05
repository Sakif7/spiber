import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { CheckoutForm } from "@/components/shop/checkout-form";
import { onlinePaymentAvailable } from "@/lib/services/payment.service";
import { getSessionUser } from "@/lib/auth/current-user";
import { findUserById } from "@/lib/repositories/users.repo";

export const dynamic = "force-dynamic";

export default async function MarketplaceCheckoutPage({
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
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("marketplace"), href: "/kart" },
          { label: t("title") },
        ]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container>
          <CheckoutForm
            initial={initial}
            onlineAvailable={onlinePaymentAvailable()}
          />
        </Container>
      </section>
    </>
  );
}
