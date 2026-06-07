import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/ui";
import { ABOUT_HERO_IMAGES } from "@/lib/hero-images";
import { namespaceMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

import { AboutPassion } from "@/components/about/passion";
import { AboutStats } from "@/components/about/stats";
import { AboutEncounter } from "@/components/about/encounter";
import { AboutMessage } from "@/components/about/message";
import { AboutCta } from "@/components/about/cta";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return namespaceMetadata(locale as Locale, "pages.about", "/about");
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "about.hero" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        images={ABOUT_HERO_IMAGES}
        imageAlt={t("title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: t("breadcrumb") },
        ]}
      />
      <AboutPassion />
      <AboutStats />
      <AboutEncounter />
      <AboutMessage />
      <AboutCta />
    </>
  );
}
