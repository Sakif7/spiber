import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { OrderLookup } from "@/components/shop/order-lookup";

export default async function OrderConfirmationPage({
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

  return (
    <>
      <PageHeader
        title={t("title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("instruments"), href: "/instruments" },
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
