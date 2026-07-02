import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { ProductRequestForm } from "@/components/marketplace/product-request-form";
import { pageMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "productRequest.hero" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/kart/request-product",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function RequestProductPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const nav = await getTranslations({ locale, namespace: "nav" });
  const t = await getTranslations({ locale, namespace: "productRequest.hero" });

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("lede")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("marketplace"), href: "/kart" },
          { label: t("breadcrumb") },
        ]}
      />
      <Section py="clamp(40px, 5vw, 80px)">
        <Container style={{ maxWidth: 720 }}>
          <ProductRequestForm />
        </Container>
      </Section>
    </>
  );
}
