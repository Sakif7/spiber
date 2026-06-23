import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { pageMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

import { Hero } from "@/components/sections/hero";
import { Pillars } from "@/components/sections/pillars";
import { SkillDevelopment } from "@/components/sections/skill-development";
import { CapitalEquipment } from "@/components/sections/capital-equipment";
import { CSRBand } from "@/components/sections/csr-band";
import { StatsBand } from "@/components/sections/stats-band";
import { Testimonials } from "@/components/sections/testimonials";
import { Management } from "@/components/sections/management";
import { LatestNews } from "@/components/sections/latest-news";
import { CTABand } from "@/components/sections/cta-band";
import { getTestimonials } from "@/lib/services/landing.service";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const meta = pageMetadata({
    locale: locale as Locale,
    path: "/",
    title: t("title"),
    description: t("description"),
  });
  // Home keeps its full brand title verbatim (no "%s — Spiber Med" template).
  return { ...meta, title: { absolute: t("title") } };
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Admin-managed homepage testimonials (only those with a portrait photo are
  // carousel-ready); falls back to the built-in set when none are configured.
  const dbTestimonials = (await getTestimonials("general"))
    .filter((x) => x.imageSrc)
    .map((x) => ({
      quote: x.quote,
      name: x.name,
      designation: x.role,
      src: x.imageSrc as string,
    }));

  return (
    <>
      <Hero />
      <Pillars />
      <SkillDevelopment />
      <CapitalEquipment />
      <CSRBand />
      <StatsBand />
      <Testimonials
        items={dbTestimonials.length ? dbTestimonials : undefined}
      />
      <Management />
      <LatestNews />
      <CTABand />
    </>
  );
}
