import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/ui";
import { CompanyTabs } from "@/components/layout/section-tabs";
import { namespaceMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";
import {
  PhilosophyIntro,
  PhilosophyPillars,
  PhilosophyValues,
} from "@/components/company/philosophy-sections";
import { CompanyCta } from "@/components/company/cta";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return namespaceMetadata(
    locale as Locale,
    "pages.corporatePhilosophy",
    "/company/corporate-philosophy",
  );
}

export default async function CorporatePhilosophyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const hero = await getTranslations({ locale, namespace: "philosophy.hero" });
  const cta = await getTranslations({ locale, namespace: "philosophy.cta" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  return (
    <>
      <PageHeader
        title={hero("title")}
        description={hero("description")}
        image="/smiling-medical-team-portrait.jpeg"
        imageAlt={hero("title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("company") },
          { label: hero("breadcrumb") },
        ]}
      />
      <CompanyTabs />
      <PhilosophyIntro />
      <PhilosophyPillars />
      <PhilosophyValues />
      <CompanyCta
        title={cta("title")}
        description={cta("description")}
        primaryHref="/contact"
        primaryLabel={cta("primary")}
        secondaryHref="/company/vision-2040"
        secondaryLabel={cta("secondary")}
      />
    </>
  );
}
