import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { OrderLookup } from "@/components/shop/order-lookup";
import { findOrderForGuest } from "@/lib/repositories/orders.repo";

export const dynamic = "force-dynamic";

// Terminal/late statuses replace the "Order confirmed" H1 with an honest one.
const TITLE_KEY: Record<string, string> = {
  shipped: "titleShipped",
  delivered: "titleDelivered",
  cancelled: "titleCancelled",
  refunded: "titleRefunded",
};

export default async function MedtradeOrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; orderNumber: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const { locale, orderNumber } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email : undefined;
  const t = await getTranslations({ locale, namespace: "shop.confirmation" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  // Status-aware title: a cancelled order must not greet with "Order confirmed".
  let titleKey = "title";
  if (email) {
    const order = await findOrderForGuest(orderNumber, email).catch(() => null);
    if (order && TITLE_KEY[order.status]) titleKey = TITLE_KEY[order.status];
  }

  return (
    <>
      <PageHeader
        title={t(titleKey)}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("instruments"), href: "/medtrade" },
          { label: t("title") },
        ]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container>
          <OrderLookup initialOrderNumber={orderNumber} initialEmail={email} />
        </Container>
      </section>
    </>
  );
}
