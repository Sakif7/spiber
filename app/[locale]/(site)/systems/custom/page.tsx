import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { InquiryForm } from "@/components/systems/inquiry-form";
import { pageMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "systems.custom" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/systems/custom",
    title: t("title"),
    description: t("lede"),
  });
}

export default async function CustomSolutionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "systems" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  return (
    <>
      <PageHeader
        eyebrow={nav("systems")}
        title={t("custom.title")}
        description={t("custom.lede")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("systems"), href: "/systems" },
          { label: t("custom.title") },
        ]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container style={{ maxWidth: 720 }}>
          <InquiryForm />
        </Container>
      </section>
    </>
  );
}
