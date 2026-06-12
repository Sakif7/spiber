import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { PartnerForm } from "@/components/tourism/forms";
import { pageMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tourism.partner" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/tourism/partner",
    title: t("title"),
    description: t("lede"),
  });
}

export default async function PartnerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "tourism.partner" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("lede")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("tourism"), href: "/tourism" },
          { label: t("title") },
        ]}
      />
      <Section>
        <Container>
          <PartnerForm />
        </Container>
      </Section>
    </>
  );
}
