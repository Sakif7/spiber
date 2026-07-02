import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { CartView } from "@/components/shop/cart-view";

export const dynamic = "force-dynamic";

export default async function MarketplaceCartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "shop.cart" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  return (
    <>
      <PageHeader
        title={t("title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("marketplace"), href: "/marketplace" },
          { label: t("title") },
        ]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container>
          <CartView />
        </Container>
      </section>
    </>
  );
}
