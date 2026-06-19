import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/ui";
import { CompanyTabs } from "@/components/layout/section-tabs";
import { namespaceMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";
import {
  VisionIntro,
  VisionCompass,
  VisionTransformations,
} from "@/components/company/vision-sections";
import { CompanyCta } from "@/components/company/cta";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return namespaceMetadata(
    locale as Locale,
    "pages.vision2040",
    "/company/vision-2040",
  );
}

export default async function Vision2040Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const hero = await getTranslations({ locale, namespace: "vision2040.hero" });
  const cta = await getTranslations({ locale, namespace: "vision2040.cta" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  return (
    <>
      <PageHeader
        title={hero("title")}
        description={hero("description")}
        image="/surgeon-viewing-medical-imaging-screen.jpeg"
        imageAlt={hero("title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("company") },
          { label: hero("breadcrumb") },
        ]}
      />
      <CompanyTabs />
      <VisionIntro />
      <VisionCompass />
      <VisionTransformations />
      <CompanyCta
        title={cta("title")}
        description={cta("description")}
        primaryHref="/contact"
        primaryLabel={cta("primary")}
        secondaryHref="/company/career"
        secondaryLabel={cta("secondary")}
      />
    </>
  );
}
